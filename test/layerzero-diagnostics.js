const { ethers } = require('hardhat');

// Import configuration from setpeer.js
const abi = require("./abi.json");
const { accounts } = require("../config");
const { INFURA_API_KEY, BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require("../env");
const { Options } = require('@layerzerolabs/lz-v2-utilities');

// RPC URLs from setpeer.js
const RPC_URLS = {
  linea: "https://rpc.linea.build",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  base: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
  optimism: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
};

// Contract addresses from setpeer.js
const CONTRACT_ADDRESSES = {
  linea: "", 
  arbitrum: "", 
  base: BASE_DEPLOYED_CONTRACT_ADDRESS || "0xB0f9321f21950989dAdaDD007729F13c640d0353",
  optimism: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS || "0xB4fF660ebd25a15E2b9cF3557d9D0288298B9A74",
};

// Chain IDs for LayerZero from setpeer.js
const CHAIN_IDS = {
  linea: 30183,    // Linea
  arbitrum: 30110, // Arbitrum
  base: 30184,     // Base
  optimism: 30111  // Optimism
};

// Use the ABI from setpeer.js
const contractABI = abi;

// User wallet address for testing
const USER_ADDRESS = "0xF2de1E3000fbD29cD227aFc3B86721987B4AF701";

// Use the same authentication method as setpeer.js
async function getSigner(networkName) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[networkName]);
    const signer = new ethers.Wallet(accounts[0], provider);
    return signer;
  } catch (error) {
    console.error(`Error getting signer for ${networkName}:`, error.message);
    process.exit(1);
  }
}

// Helper function to get contract instance
async function getContract(network) {
  try {
    const signer = await getSigner(network);
    return new ethers.Contract(CONTRACT_ADDRESSES[network], contractABI, signer);
  } catch (error) {
    console.error(`Error getting contract for ${network}:`, error.message);
    process.exit(1);
  }
}

// Helper function to format ETH values
function formatEth(wei) {
  return ethers.formatUnits(wei, 18);
}

// Helper function to get event logs
async function getEventLogs(txReceipt, eventName, contract) {
  if (!txReceipt || !txReceipt.logs) {
    console.log(`Error: Invalid transaction receipt`);
    return [];
  }
  
  console.log(`Searching for ${eventName} events in transaction ${txReceipt.transactionHash}`);
  console.log(`Total logs in receipt: ${txReceipt.logs.length}`);
  
  // Debug: Print all log addresses vs contract address
  if (contract && contract.address) {
    console.log(`Contract address: ${contract.address}`);
    txReceipt.logs.forEach((log, i) => {
      if (log.address && contract.address) {
        console.log(`Log ${i} address: ${log.address} matches contract: ${log.address.toLowerCase() === contract.address.toLowerCase()}`);
      }
    });
  } else {
    console.log('Warning: Contract or contract address is undefined');
  }
  
  if (!contract || !contract.interface) {
    console.log('Error: Contract interface is undefined');
    return [];
  }
  
  const eventInterface = contract.interface;
  
  // Try to parse all logs regardless of address
  const allParsedLogs = [];
  for (const log of txReceipt.logs) {
    try {
      const parsed = eventInterface.parseLog(log);
      if (parsed) {
        allParsedLogs.push({
          name: parsed.name,
          args: parsed.args,
          address: log.address
        });
      }
    } catch (e) {
      // Ignore parsing errors
    }

  }
  
  console.log(`Successfully parsed ${allParsedLogs.length} logs`);
  if (allParsedLogs.length > 0) {
    console.log(`Found event types: ${[...new Set(allParsedLogs.map(l => l.name))].join(', ')}`);
  } else {
    console.log('No logs were successfully parsed');
  }
  
  // Filter for the requested event name
  const logs = allParsedLogs.filter(log => log.name === eventName);
  console.log(`Found ${logs.length} ${eventName} events`);
  
  return logs;
}

// Helper function to analyze mintFromPool flow based on debug events
function analyzeMintFlow(debugStringEvents, mintError) {
  console.log("\n=== MintFromPool Flow Analysis ===\n");
  
  if (mintError) {
    console.log("❌ Mint transaction failed and reverted.");
    console.log(`   Error: ${mintError.message}`);
    console.log("\n   Analysis: The transaction was stopped by a 'revert' operation in the smart contract.");
    console.log("   The error message above usually contains the specific reason for the failure (e.g., 'PoolFull', 'NotWhitelisted').");
    console.log("   NOTE: Debug events emitted before a 'revert' are NOT saved on the blockchain, so we cannot trace the execution flow using events for a failed transaction.");
    return false; // Indicate failure
  }

  // Group events by context
  const mintFlowEvents = debugStringEvents.filter(event => event.args[0] === "mintFromPool");

  if (mintFlowEvents.length === 0) {
      console.log("⚠️ No 'mintFromPool' debug events found, even though the transaction succeeded.");
      console.log("   This might indicate an issue with event emission or filtering. The mint might have occurred without debug logs.");
      return true; // Transaction succeeded, but no flow to analyze
  }

  console.log("Execution Trace from 'mintFromPool' events:");
  let lastMessage = "";
  mintFlowEvents.forEach(event => {
      const message = event.args[1];
      console.log(`- ${message}`);
      lastMessage = message;
  });

  console.log("\nMintFromPool Flow Summary:");
  
  if (lastMessage.startsWith("Fail:")) {
      console.log(`❌ Flow failed with message: "${lastMessage}". This indicates an issue within the contract logic that didn't cause a revert.`);
      return false;
  }
  
  const mintSuccessful = mintFlowEvents.some(e => e.args[1] === "Mint Successful");
  const notifyStarted = mintFlowEvents.some(event => event.args[1] === "Starting notification process");
  const notifySucceeded = mintFlowEvents.some(event => event.args[1] === "Notify Success");
  
  if (mintSuccessful) {
      console.log("✅ Mint appears to be successful.");
  } else {
      console.log("❌ Mint did not complete successfully, as 'Mint Successful' event was not found.");
      return false;
  }

  console.log("\nCross-Chain Notification Status (within mint flow):");
  if (notifyStarted) {
    if (notifySucceeded) {
      console.log("✅ Cross-chain notification process completed successfully within the mint flow.");
    } else {
      console.log("⚠️ Cross-chain notification process started but did not emit 'Notify Success'. Check detailed notification analysis below.");
    }
  } else {
    console.log("❌ Cross-chain notification was not attempted after a successful mint.");
  }

  return notifySucceeded;
}

// Analyze notification details from _notifyOtherChains function
function analyzeNotificationDetails(mintReceipt, contract) {
  if (!mintReceipt) {
    console.log("No mint receipt available to analyze notification details.");
    return;
  }
  
  console.log("\nCross-Chain Notification Analysis:");
  
  // Get all Debug events from transaction receipt
  const debugEvents = mintReceipt.logs
    .map(log => {
        try {
            return contract.interface.parseLog(log);
        } catch (e) {
            return null;
        }
    })
    .filter(log => log && (log.name === 'Debug' || log.name === 'DebugString'))
    .map(log => ({
      name: log.name,
      args: log.args
    }));
  
  // Find key notification events
  const invalidParamsEvents = debugEvents.filter(e => e.name === 'Debug' && e.args[0] === "Invalid notify params");
  const noDestinationsEvents = debugEvents.filter(e => e.name === 'Debug' && e.args[0] === "No destination chains");
  const feeQuoteFailedEvents = debugEvents.filter(e => e.name === 'Debug' && e.args[0] === "Fee quote failed");
  const insufficientFundsEvents = debugEvents.filter(e => e.name === 'Debug' && e.args[0] === "Insufficient funds for all messages");
  const sendSuccessEvents = debugEvents.filter(e => e.name === 'Debug' && e.args[0] === "LZ send successful");
  const sendFailedEvents = debugEvents.filter(e => e.name === 'Debug' && e.args[0] === "LZ send failed");
  const feeQuoteReasonEvents = debugEvents.filter(e => e.name === 'DebugString' && e.args[0] === "Fee quote failed reason");

  
  // Check for basic errors
  if (invalidParamsEvents.length > 0) {
    console.log("❌ Invalid notification parameters detected");
    return;
  }
  
  if (noDestinationsEvents.length > 0) {
    console.log("⚠️ No destination chains were found to notify");
    return;
  }
  
  // Analyze success/failure rates
  const totalSuccess = sendSuccessEvents.length;
  const totalFailed = sendFailedEvents.length + feeQuoteFailedEvents.length;
  
  console.log("\nNotification Results:");
  console.log(`- Successful notifications: ${totalSuccess}`);
  console.log(`- Failed notifications: ${totalFailed}`);
  
  if (totalSuccess > 0 && totalFailed === 0) {
    console.log("✅ All cross-chain notifications were successful");
  } else if (totalSuccess > 0 && totalFailed > 0) {
    console.log("⚠️ Some cross-chain notifications failed");
  } else if (totalSuccess === 0 && totalFailed > 0) {
    console.log("❌ All cross-chain notifications failed");
  }
  
  // Show details about successful notifications
  if (sendSuccessEvents.length > 0) {
    console.log("\nSuccessful Notifications:");
    sendSuccessEvents.forEach(event => {
      console.log(`- To chain EID ${event.args[2]}: Success`);
    });
  }
  
  // Show details about failed notifications
  if (sendFailedEvents.length > 0) {
    console.log("\nFailed Send Attempts:");
    sendFailedEvents.forEach(event => {
      console.log(`- To chain EID ${event.args[2]}: Failed to send message`);
    });
  }
  
  // Check for fee quote failures
  if (feeQuoteFailedEvents.length > 0) {
    console.log("\n⚠️ Fee Quote Failures:");
    feeQuoteFailedEvents.forEach(event => {
      console.log(`- Failed to get fee quote for chain EID ${event.args[2]}`);
    });
  }
  
  if (feeQuoteReasonEvents.length > 0) {
    console.log("\n⚠️ Fee Quote Failure Reasons:");
    feeQuoteReasonEvents.forEach(event => {
        // reason is often 'OApp: peer not set'
      console.log(`- ${event.args[1]}`);
    });
  }

  // Check for insufficient funds
  if (insufficientFundsEvents.length > 0) {
    console.log("\n⚠️ Insufficient Funds for LayerZero Fees:");
    insufficientFundsEvents.forEach(event => {
      console.log(`- Contract requires ${formatEth(event.args[2])} ETH for gas, but has insufficient balance.`);
    });
    console.log("\nRecommendation: Fund the contract with more ETH to cover LayerZero fees");
  }
}

// Main diagnostic function
async function runLayerZeroDiagnostics() {
  console.log("=== LayerZero Cross-Chain Messaging Diagnostics ===\n");
  
  // Get contract instances
  const baseContract = await getContract('base');
  const optimismContract = await getContract('optimism');
  
  // Step 1: Check contract balances
  console.log("Step 1: Checking contract balances for LayerZero fees");
  const baseProvider = new ethers.JsonRpcProvider(RPC_URLS['base']);
  const optimismProvider = new ethers.JsonRpcProvider(RPC_URLS['optimism']);
  
  const baseBalance = await baseProvider.getBalance(CONTRACT_ADDRESSES['base']);
  const optimismBalance = await optimismProvider.getBalance(CONTRACT_ADDRESSES['optimism']);
  
  console.log(`Base contract balance: ${formatEth(baseBalance)} ETH`);
  console.log(`Optimism contract balance: ${formatEth(optimismBalance)} ETH`);
  
  const minBalance = ethers.parseUnits("0.001", 18);
  if (baseBalance < minBalance || optimismBalance < minBalance) {
    console.log("⚠️ WARNING: Contract balance may be too low for LayerZero fees");
  } else {
    console.log("✅ Contract balances appear sufficient");
  }
  
  // Step 2: Check peer configuration
  console.log("\nStep 2: Verifying peer configuration");
  
  // Calculate expected peer values
  // Use contract addresses directly from CONTRACT_ADDRESSES
  const baseAddress = CONTRACT_ADDRESSES['base'];
  const optimismAddress = CONTRACT_ADDRESSES['optimism'];
  
  console.log(`Base contract address: ${baseAddress}`);
  console.log(`Optimism contract address: ${optimismAddress}`);
  
  const expectedBaseToPeer = ethers.zeroPadValue(optimismAddress, 32);
  
  const expectedOptimismToPeer = ethers.zeroPadValue(baseAddress, 32);
  
  // Get actual peer values
  const baseToPeer = await baseContract.peers(CHAIN_IDS.optimism);
  const optimismToPeer = await optimismContract.peers(CHAIN_IDS.base);
  
  console.log(`Base -> Optimism peer (actual): ${baseToPeer}`);
  console.log(`Base -> Optimism peer (expected): ${expectedBaseToPeer}`);
  console.log(`Optimism -> Base peer (actual): ${optimismToPeer}`);
  console.log(`Optimism -> Base peer (expected): ${expectedOptimismToPeer}`);
  
  if (baseToPeer.toLowerCase() !== expectedBaseToPeer.toLowerCase() || optimismToPeer.toLowerCase() !== expectedOptimismToPeer.toLowerCase()) {
    console.log("⚠️ WARNING: Peer configuration may be incorrect");
  } else {
    console.log("✅ Peer configuration appears correct");
  }
  
  // Step 3: Check gas limits
  console.log("\nStep 3: Checking LayerZero gas limits");
  
  const baseDefaultGasLimit = await baseContract.defaultGasLimit();
  const optimismDefaultGasLimit = await optimismContract.defaultGasLimit();
  
  const baseToOptimismGasLimit = await baseContract.crossChainGasLimits(CHAIN_IDS.optimism);
  const optimismToBaseGasLimit = await optimismContract.crossChainGasLimits(CHAIN_IDS.base);
  
  console.log(`Base default gas limit: ${baseDefaultGasLimit.toString()}`);
  console.log(`Base -> Optimism specific gas limit: ${baseToOptimismGasLimit.toString()}`);
  console.log(`Optimism default gas limit: ${optimismDefaultGasLimit.toString()}`);
  console.log(`Optimism -> Base specific gas limit: ${optimismToBaseGasLimit.toString()}`);
  
  if (Number(baseToOptimismGasLimit) === 0 && Number(baseDefaultGasLimit) < 200000) {
    console.log("⚠️ WARNING: Base -> Optimism gas limit may be too low");
  }
  
  if (Number(optimismToBaseGasLimit) === 0 && Number(optimismDefaultGasLimit) < 200000) {
    console.log("⚠️ WARNING: Optimism -> Base gas limit may be too low");
  }
  
  // Step 4: Test cross-chain message fee estimation
  console.log("\nStep 4: Testing LayerZero fee estimation");
  
  try {
    // Create a test message similar to what would be sent in _notifyOtherChains
    const poolId = 2; // Using pool 2 for testing
    
    // Get the ActionType.SyncMintStatus enum value (should be 2 based on contract)
    const syncMintStatusActionType = 2;
    
    // Create a test message
    const testMessage = {
      actionType: syncMintStatusActionType,
      account: USER_ADDRESS,
      amount: 0,
      poolId: poolId
    };
    
    // Encode the message as the contract would
    const encodedMessage = new ethers.AbiCoder().encode(
      ['tuple(uint8 actionType, address account, uint256 amount, uint8 poolId)'],
      [testMessage]
    );
    
    // Get the gas limit that would be used
    const gasLimit = baseToOptimismGasLimit > 0 ? baseToOptimismGasLimit : baseDefaultGasLimit;
    
    // Create options bytes as the contract would
    // This is a simplified version - actual OptionsBuilder usage would be more complex
    const options = Options.newOptions().addExecutorLzReceiveOption(gasLimit, 0).toHex().toString()
    
    // Estimate the fee using estimateMessagingFee (public function without authorization check)
    const estimatedFee = await baseContract.quoteSyncFee(CHAIN_IDS.optimism, encodedMessage, options);
    
    console.log(`Estimated LayerZero fee: ${formatEth(estimatedFee.nativeFee)} ETH`);
    console.log(`Contract balance: ${formatEth(baseBalance)} ETH`);
    
    if (baseBalance < estimatedFee.nativeFee) {
      console.log("⚠️ WARNING: Contract balance is less than estimated fee");
    } else {
      console.log("✅ Contract balance is sufficient for estimated fee");
    }
  } catch (error) {
    console.error("Error estimating fee:", error.message);
  }
  
  // Step 5: Test cross-chain message sending
  console.log("\nStep 5: Testing cross-chain message sending");
  console.log("Resetting user mint status on Base...");
  
  try {
    // First reset user mint status
    const resetTx = await baseContract.resetUserMint(USER_ADDRESS);
    await resetTx.wait();
    console.log("User mint status reset successfully");
    
    // Check initial state
    const hasMintedGlobal = await baseContract.hasMintedGlobal(USER_ADDRESS);
    const mintedOnChain = await baseContract.mintedOnChain(USER_ADDRESS);
    const mintCountPool2 = await baseContract.mintCountPerPool(2, USER_ADDRESS);
    
    console.log(`Initial state - hasMintedGlobal: ${hasMintedGlobal}, mintedOnChain: ${mintedOnChain}, mintCountPool2: ${mintCountPool2}`);
    
    // Enable pool if needed
    let poolInfo = await baseContract.pools(2);
    if (!poolInfo.enabled) {
      console.log("Enabling pool 2...");
      const enableTx = await baseContract.enablePool(2);
      await enableTx.wait();
      // Refresh pool info after enabling
      poolInfo = await baseContract.pools(2);
    }
    
    // Whitelist user if needed
    const isWhitelisted = await baseContract.whitelist(2, USER_ADDRESS);
    if (!isWhitelisted) {
      console.log("Whitelisting user for pool 2...");
      const whitelistTx = await baseContract.setWhitelist(2, [USER_ADDRESS], true);
      await whitelistTx.wait();
    }
    
    // Perform mint with detailed event logging
    console.log("Performing test mint with event tracing...");
    // Use the already fetched poolInfo
    const mintPrice = poolInfo.mintPrice;
    
    console.log(`Pool 2 info: enabled=${poolInfo.enabled}, price=${ethers.formatEther(mintPrice)} ETH`);
    
    // Mint with correct price and extra gas for event logging
    let mintReceipt;
    let mintError;
    try {
      // Build LayerZero options from the client
      const gasLimit = 800000;
      const options = Options.newOptions().addExecutorLzReceiveOption(gasLimit, 0).toHex().toString()

      // Create a test message to quote the fee
      const testMessage = new ethers.AbiCoder().encode(
          ['tuple(uint8 actionType, address account, uint256 amount, uint8 poolId)'],
          [{ actionType: 2, account: USER_ADDRESS, amount: 0, poolId: 2 }]
      );

      // Estimate the fee for the cross-chain message
      const estimatedFee = await baseContract.quoteSyncFee(CHAIN_IDS.optimism, testMessage, options);
      console.log(`Estimated LZ Fee: ${ethers.formatEther(estimatedFee.nativeFee)} ETH`);

      // Add a 10% buffer to the estimated fee to account for gas price fluctuations
      const bufferedFee = (estimatedFee.nativeFee * 110n) / 100n;
      console.log(`Buffered LZ Fee (10% buffer): ${ethers.formatEther(bufferedFee)} ETH`);

      // Total value to send = mint price + buffered fee
      const totalValue = mintPrice + bufferedFee;
      console.log(`Total value sent (mint price + fee): ${ethers.formatEther(totalValue)} ETH`);

      const mintTx = await baseContract.mintFromPool(2, options, {
        value: totalValue,
        gasLimit: 800000
      });
      mintReceipt = await mintTx.wait();
    } catch (error) {
      mintError = error;
      console.error(`\nError during mint transaction: ${error.message}`);
      if (error.transactionHash) {
        console.log(`Failed transaction hash: ${error.transactionHash}`);
      }
    }
    
    let debugEvents = [];
    let debugStringEvents = [];
    
    if (mintReceipt) {
      console.log(`Mint transaction hash: ${mintReceipt.transactionHash}`);
      console.log(`Gas used: ${mintReceipt.gasUsed.toString()}`);
      
      // Extract events
      debugEvents = await getEventLogs(mintReceipt, "Debug", baseContract);
      debugStringEvents = await getEventLogs(mintReceipt, "DebugString", baseContract);
      
      console.log("\nRaw Debug events:");
      debugEvents.forEach(event => {
        console.log(`- ${event.name}: ${event.args[0]} | User: ${event.args[1]} | Value: ${event.args[2]} | PoolId: ${event.args[3]}`);
      });
      
      console.log("\nRaw Debug string events:");
      debugStringEvents.forEach(event => {
        console.log(`- ${event.name}: ${event.args[0]} | ${event.args[1]}`);
      });
    } else {
      console.error("Error: Mint transaction failed or receipt is undefined.");
    }
    
    // Perform detailed analysis of the mint flow using debug events
    const mintFlowSuccess = analyzeMintFlow(debugStringEvents, mintError);
    
    // Perform detailed analysis of the notification flow
    analyzeNotificationDetails(mintReceipt, baseContract);
    
    // Check if any LayerZero send events were emitted
    const lzSendEvents = debugEvents.filter(event => 
      event.args[0] === "LZ send successful"
    );
    
    console.log("\nLayerZero Message Status:");
    if (lzSendEvents.length > 0) {
      console.log(`✅ ${lzSendEvents.length} LayerZero 'send' message(s) were successfully emitted.`);
    } else if (mintFlowSuccess) {
      console.log("\n❌ ERROR: No LayerZero send events were emitted, despite a successful mint.");
    } else {
        console.log("\n- No LayerZero send events were emitted due to failed mint.");
    }
    
    // Check for failed sends
    const lzFailEvents = debugEvents.filter(event => event.args[0] === "LZ send failed");
     if(lzFailEvents.length > 0) {
        console.log(`❌ ${lzFailEvents.length} LayerZero 'send' message(s) failed.`);
        lzFailEvents.forEach(event => {
            console.log(`- Send to EID ${event.args[2]} failed.`);
        });
     }
    
    // If mint failed, no need to check remote state
    if (mintError) {
        console.log("\nSkipping remote chain state check due to mint transaction failure.");
        return;
    }
    
    // Check final state
    const finalHasMintedGlobal = await baseContract.hasMintedGlobal(USER_ADDRESS);
    const finalMintedOnChain = await baseContract.mintedOnChain(USER_ADDRESS);
    const finalMintCountPool2 = await baseContract.mintCountPerPool(2, USER_ADDRESS);
    
    console.log(`\nFinal state - hasMintedGlobal: ${finalHasMintedGlobal}, mintedOnChain: ${finalMintedOnChain}, mintCountPool2: ${finalMintCountPool2}`);
    
    // Wait for cross-chain message to propagate
    console.log("\nWaiting 60 seconds for cross-chain message to propagate...");
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Check state on destination chain
    const optimismHasMintedGlobal = await optimismContract.hasMintedGlobal(USER_ADDRESS);
    const optimismMintedOnChain = await optimismContract.mintedOnChain(USER_ADDRESS);
    const optimismMintCountPool2 = await optimismContract.mintCountPerPool(2, USER_ADDRESS);
    
    console.log(`\nOptimism state after 60s - hasMintedGlobal: ${optimismHasMintedGlobal}, mintedOnChain: ${optimismMintedOnChain}, mintCountPool2: ${optimismMintCountPool2}`);
    
    if (optimismHasMintedGlobal && optimismMintedOnChain === CHAIN_IDS.base && optimismMintCountPool2 > 0) {
      console.log("✅ Cross-chain message was successfully delivered and processed");
    } else {
      console.log("❌ Cross-chain message was not delivered or processed correctly");
    }
    
  } catch (error) {
    console.error("Error during test mint:", error.message);
  }
  
  // Step 6: Check for any pending or failed messages
  console.log("\nStep 6: Checking for pending LayerZero messages");
  
  try {
    // This would require integration with LayerZero's message status API
    // For now, we'll just provide guidance
    console.log("To check for pending LayerZero messages:");
    console.log("1. Visit the LayerZero Explorer: https://layerzeroscan.com/");
    console.log(`2. Enter the source contract address: ${CONTRACT_ADDRESSES.base}`);
    console.log("3. Look for any pending or failed messages");
  } catch (error) {
    console.error("Error checking pending messages:", error.message);
  }
  
  // Final summary and recommendations
  console.log("\n=== Diagnostic Summary ===");
  console.log("Based on the tests performed, here are potential issues:");
  console.log("1. Contract balance: Check if there's enough ETH for LayerZero fees");
  console.log("2. Gas limits: Consider increasing defaultGasLimit to at least 300000");
  console.log("3. Peer configuration: Verify peers are correctly set on both chains");
  console.log("4. Message payload: Ensure the message format is correct");
  console.log("5. Error handling: Check for specific errors in notifyOtherChainsExternal");
  
  // Check for specific issues based on the test results
  if (baseBalance < ethers.parseUnits("0.01", 18)) {
    console.log("\n❌ CRITICAL ISSUE: Base contract balance is very low (${formatEth(baseBalance)} ETH)");
    console.log("   This is likely preventing cross-chain messages from being sent");
    console.log("   Recommended action: Fund the contract with at least 0.05 ETH");
  }
  
  if (baseToOptimismGasLimit === 0 && baseDefaultGasLimit < 200000) {
    console.log("\n❌ CRITICAL ISSUE: Gas limit is too low (${baseDefaultGasLimit})");
    console.log("   This may cause cross-chain messages to fail execution on the destination chain");
    console.log("   Recommended action: Set crossChainGasLimits[${CHAIN_IDS.optimism}] to at least 300000");
  }
  
  if (baseToPeer.toLowerCase() !== expectedBaseToPeer.toLowerCase() || optimismToPeer.toLowerCase() !== expectedOptimismToPeer.toLowerCase()) {
    console.log("\n❌ CRITICAL ISSUE: Peer configuration is incorrect");
    console.log("   Messages will be rejected by the destination chain");
    console.log("   Recommended action: Run setpeer.js to fix the configuration");
  }
  
  console.log("\nRecommended actions:");
  console.log("1. Check the mintFromPool flow analysis above to identify where the process is failing");
  console.log("2. Implement a retry mechanism for failed messages");
  console.log("3. Add more detailed error reporting in the notifyOtherChainsExternal function");
  console.log("4. Consider adding a dedicated function to fund the contract for LayerZero fees");
  console.log("5. Visit LayerZero Explorer to check for pending or failed messages: https://layerzeroscan.com/");
}

// Execute the script
runLayerZeroDiagnostics()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

