const { ethers } = require('hardhat');

// Import configuration from setpeer.js
const abi = require("./abi.json");
const { accounts } = require("../config");
const { INFURA_API_KEY, BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require("../env");

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
  base: BASE_DEPLOYED_CONTRACT_ADDRESS,
  optimism: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS,
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
  const eventInterface = contract.interface;
  const logs = txReceipt.logs
    .filter(log => log.address === contract.address)
    .map(log => {
      try {
        return eventInterface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .filter(parsedLog => parsedLog !== null && parsedLog.name === eventName);
  
  return logs;
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
  
  const expectedBaseToPeer = ethers.keccak256(
    ethers.solidityPacked(
      ['bytes32', 'address'],
      [ethers.zeroPadValue(optimismAddress, 32), baseAddress]
    )
  );
  
  const expectedOptimismToPeer = ethers.keccak256(
    ethers.solidityPacked(
      ['bytes32', 'address'],
      [ethers.zeroPadValue(baseAddress, 32), optimismAddress]
    )
  );
  
  // Get actual peer values
  const baseToPeer = await baseContract.peers(CHAIN_IDS.optimism);
  const optimismToPeer = await optimismContract.peers(CHAIN_IDS.base);
  
  console.log(`Base -> Optimism peer (actual): ${baseToPeer}`);
  console.log(`Base -> Optimism peer (expected): ${expectedBaseToPeer}`);
  console.log(`Optimism -> Base peer (actual): ${optimismToPeer}`);
  console.log(`Optimism -> Base peer (expected): ${expectedOptimismToPeer}`);
  
  if (baseToPeer !== expectedBaseToPeer || optimismToPeer !== expectedOptimismToPeer) {
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
    const options = "0x"; // Simplified for testing
    
    // Estimate the fee
    const estimatedFee = await baseContract.quote(CHAIN_IDS.optimism, encodedMessage, options, false);
    
    console.log(`Estimated LayerZero fee: ${formatEth(estimatedFee.nativeFee)} ETH`);
    console.log(`Contract balance: ${formatEth(baseBalance)} ETH`);
    
    if (baseBalance.lt(estimatedFee.nativeFee)) {
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
    const poolInfo = await baseContract.pools(2);
    if (!poolInfo.enabled) {
      console.log("Enabling pool 2...");
      const enableTx = await baseContract.enablePool(2);
      await enableTx.wait();
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
    const mintPrice = await baseContract.pools(2).then(pool => pool.mintPrice);
    
    // Mint with extra gas for event logging
    const mintTx = await baseContract.mintFromPool(2, { value: mintPrice, gasLimit: 500000 });
    const receipt = await mintTx.wait();
    
    console.log(`Mint transaction hash: ${receipt.transactionHash}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    // Extract events
    const debugEvents = await getEventLogs(receipt, "Debug", baseContract);
    const debugStringEvents = await getEventLogs(receipt, "DebugString", baseContract);
    
    console.log("\nDebug events:");
    debugEvents.forEach(event => {
      console.log(`- ${event.name}: ${event.args[0]} | User: ${event.args[1]} | Value: ${event.args[2]} | PoolId: ${event.args[3]}`);
    });
    
    console.log("\nDebug string events:");
    debugStringEvents.forEach(event => {
      console.log(`- ${event.name}: ${event.args[0]} | ${event.args[1]}`);
    });
    
    // Check if any LayerZero send events were emitted
    const lzSendEvents = debugEvents.filter(event => 
      event.args[0] === "LZ send successful" || 
      event.args[0] === "Native balance check" ||
      event.args[0] === "Insufficient native balance"
    );
    
    if (lzSendEvents.length > 0) {
      console.log("\n✅ LayerZero send events were emitted:");
      lzSendEvents.forEach(event => {
        console.log(`- ${event.args[0]} | User: ${event.args[1]} | Value: ${event.args[2]} | PoolId: ${event.args[3]}`);
      });
    } else {
      console.log("\n⚠️ WARNING: No LayerZero send events were emitted");
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
  console.log("5. Error handling: Add more detailed error logging in _notifyOtherChains");
  console.log("\nRecommended actions:");
  console.log("1. Add more debug events in the contract to track message sending");
  console.log("2. Implement a retry mechanism for failed messages");
  console.log("3. Update to the latest LayerZero libraries if possible");
  console.log("4. Consider using LayerZero's message status API for better monitoring");
}

// Execute the script
runLayerZeroDiagnostics()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
