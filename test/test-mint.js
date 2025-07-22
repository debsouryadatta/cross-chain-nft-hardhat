const { ethers } = require("ethers");
const abi = require("./abi.json");
const { accounts } = require("../config");
const { INFURA_API_KEY, BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require("../env");

// Contract addresses on each chain
const CONTRACT_ADDRESSES = {
  base: BASE_DEPLOYED_CONTRACT_ADDRESS,     // Base contract address
  optimism: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS, // Optimism contract address
};

// RPC URLs for each network
const RPC_URLS = {
  base: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
  optimism: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
};

// Test wallet (using first account from config)
const PRIVATE_KEY = accounts[0];

// Pool IDs to test
const TEST_POOL_ID = 3; // Using pool 3 for testing (whitelist pool)

// Gas settings
const GAS_SETTINGS = {
  base: {
    gasLimit: 500000,
    maxFeePerGas: ethers.parseUnits("0.1", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei")
  },
  optimism: {
    gasLimit: 500000,
    maxFeePerGas: ethers.parseUnits("0.1", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei")
  }
};

async function main() {
  console.log("=== Testing Cross-Chain Mint Functionality ===\n");
  
  // Step 1: Connect to both chains
  const baseProvider = new ethers.JsonRpcProvider(RPC_URLS.base);
  const optimismProvider = new ethers.JsonRpcProvider(RPC_URLS.optimism);
  
  const baseSigner = new ethers.Wallet(PRIVATE_KEY, baseProvider);
  const optimismSigner = new ethers.Wallet(PRIVATE_KEY, optimismProvider);
  
  const baseContract = new ethers.Contract(CONTRACT_ADDRESSES.base, abi, baseSigner);
  const optimismContract = new ethers.Contract(CONTRACT_ADDRESSES.optimism, abi, optimismSigner);
  
  console.log("Connected to contracts on Base and Optimism");
  console.log(`Base contract: ${CONTRACT_ADDRESSES.base}`);
  console.log(`Optimism contract: ${CONTRACT_ADDRESSES.optimism}`);
  console.log(`Using wallet address: ${baseSigner.address}\n`);
  
  // Step 2: Check initial state on both chains
  console.log("=== Initial State ===");
  await checkMintStatus(baseContract, optimismContract, baseSigner.address);
  
  // Step 3: Enable pools and add to whitelist if needed
  console.log("\n=== Preparing Pools ===");
  await preparePoolsForMinting(baseContract, optimismContract, baseSigner.address);
  
  // Step 4: Mint on Base chain
  console.log("\n=== Minting on Base Chain ===");
  await mintOnChain(baseContract, "Base", baseSigner);
  
  // Step 5: Wait for cross-chain message to propagate
  console.log("\n=== Waiting for Cross-Chain Message Propagation ===");
  console.log("Waiting 60 seconds for LayerZero message to propagate...");
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  // Step 6: Check updated state on both chains
  console.log("\n=== Updated State After Base Mint ===");
  await checkMintStatus(baseContract, optimismContract, baseSigner.address);
  
  // Step 7: Try to mint on Optimism chain (should fail if cross-chain limit is enforced)
  console.log("\n=== Attempting to Mint on Optimism Chain ===");
  await mintOnChain(optimismContract, "Optimism", optimismSigner);
  
  // Step 8: Final state check
  console.log("\n=== Final State ===");
  await checkMintStatus(baseContract, optimismContract, baseSigner.address);
}

async function checkMintStatus(baseContract, optimismContract, address) {
  try {
    // Check global mint status on Base
    const baseGlobalMintInfo = await baseContract.getUserMintInfo(address);
    console.log("Base Chain Global Mint Status:");
    console.log(`- Has minted globally: ${baseGlobalMintInfo[0]}`);
    console.log(`- Chain minted on: ${baseGlobalMintInfo[1]}`);
    
    // Check pool-specific mint count on Base
    const baseMintCount = await baseContract.getUserMintCount(address, TEST_POOL_ID);
    console.log(`- Mint count for pool ${TEST_POOL_ID}: ${baseMintCount}`);
    
    // Check global mint status on Optimism
    const optimismGlobalMintInfo = await optimismContract.getUserMintInfo(address);
    console.log("\nOptimism Chain Global Mint Status:");
    console.log(`- Has minted globally: ${optimismGlobalMintInfo[0]}`);
    console.log(`- Chain minted on: ${optimismGlobalMintInfo[1]}`);
    
    // Check pool-specific mint count on Optimism
    const optimismMintCount = await optimismContract.getUserMintCount(address, TEST_POOL_ID);
    console.log(`- Mint count for pool ${TEST_POOL_ID}: ${optimismMintCount}`);
    
    // Check token balances
    const baseBalance = await baseContract.balanceOf(address);
    const optimismBalance = await optimismContract.balanceOf(address);
    console.log("\nToken Balances:");
    console.log(`- Base: ${ethers.formatUnits(baseBalance, 18)}`);
    console.log(`- Optimism: ${ethers.formatUnits(optimismBalance, 18)}`);
    
  } catch (error) {
    console.error("Error checking mint status:", error.message);
  }
}

async function preparePoolsForMinting(baseContract, optimismContract, address) {
  try {
    // Check if pools are enabled on Base
    const basePoolInfo = await baseContract.getPoolInfo(TEST_POOL_ID);
    console.log(`Base Pool ${TEST_POOL_ID} Status: ${basePoolInfo.enabled ? "Enabled" : "Disabled"}`);
    
    // Enable pool on Base if needed
    if (!basePoolInfo.enabled) {
      console.log(`Enabling pool ${TEST_POOL_ID} on Base...`);
      const tx = await baseContract.enablePool(TEST_POOL_ID, GAS_SETTINGS.base);
      await tx.wait();
      console.log(`Pool ${TEST_POOL_ID} enabled on Base`);
    }
    
    // Check if pools are enabled on Optimism
    const optimismPoolInfo = await optimismContract.getPoolInfo(TEST_POOL_ID);
    console.log(`Optimism Pool ${TEST_POOL_ID} Status: ${optimismPoolInfo.enabled ? "Enabled" : "Disabled"}`);
    
    // Enable pool on Optimism if needed
    if (!optimismPoolInfo.enabled) {
      console.log(`Enabling pool ${TEST_POOL_ID} on Optimism...`);
      const tx = await optimismContract.enablePool(TEST_POOL_ID, GAS_SETTINGS.optimism);
      await tx.wait();
      console.log(`Pool ${TEST_POOL_ID} enabled on Optimism`);
    }
    
    // Check if address is whitelisted on Base
    const baseWhitelisted = await baseContract.whitelist(TEST_POOL_ID, address);
    console.log(`Base Whitelist Status for Pool ${TEST_POOL_ID}: ${baseWhitelisted ? "Whitelisted" : "Not Whitelisted"}`);
    
    // Add to whitelist on Base if needed
    if (!baseWhitelisted) {
      console.log(`Adding address to whitelist on Base for pool ${TEST_POOL_ID}...`);
      const tx = await baseContract.setWhitelist(
        TEST_POOL_ID, 
        [address], 
        true,
        GAS_SETTINGS.base
      );
      await tx.wait();
      console.log(`Address added to whitelist on Base`);
    }
    
    // Check if address is whitelisted on Optimism
    const optimismWhitelisted = await optimismContract.whitelist(TEST_POOL_ID, address);
    console.log(`Optimism Whitelist Status for Pool ${TEST_POOL_ID}: ${optimismWhitelisted ? "Whitelisted" : "Not Whitelisted"}`);
    
    // Add to whitelist on Optimism if needed
    if (!optimismWhitelisted) {
      console.log(`Adding address to whitelist on Optimism for pool ${TEST_POOL_ID}...`);
      const tx = await optimismContract.setWhitelist(
        TEST_POOL_ID, 
        [address], 
        true,
        GAS_SETTINGS.optimism
      );
      await tx.wait();
      console.log(`Address added to whitelist on Optimism`);
    }
    
    // Enable minting on both chains if needed
    const baseMintingEnabled = await baseContract.mintingEnabled();
    if (!baseMintingEnabled) {
      console.log("Enabling minting on Base...");
      const tx = await baseContract.setMintingEnabled(true, GAS_SETTINGS.base);
      await tx.wait();
      console.log("Minting enabled on Base");
    }
    
    const optimismMintingEnabled = await optimismContract.mintingEnabled();
    if (!optimismMintingEnabled) {
      console.log("Enabling minting on Optimism...");
      const tx = await optimismContract.setMintingEnabled(true, GAS_SETTINGS.optimism);
      await tx.wait();
      console.log("Minting enabled on Optimism");
    }
    
    // Enable cross-chain functionality on both chains if needed
    const baseCrossChainEnabled = await baseContract.crossChainEnabled();
    if (!baseCrossChainEnabled) {
      console.log("Enabling cross-chain on Base...");
      const tx = await baseContract.setCrossChainEnabled(true, GAS_SETTINGS.base);
      await tx.wait();
      console.log("Cross-chain enabled on Base");
    }
    
    const optimismCrossChainEnabled = await optimismContract.crossChainEnabled();
    if (!optimismCrossChainEnabled) {
      console.log("Enabling cross-chain on Optimism...");
      const tx = await optimismContract.setCrossChainEnabled(true, GAS_SETTINGS.optimism);
      await tx.wait();
      console.log("Cross-chain enabled on Optimism");
    }
    
  } catch (error) {
    console.error("Error preparing pools:", error.message);
  }
}

async function mintOnChain(contract, chainName, signer) {
  try {
    // Get pool info to determine mint price
    const poolInfo = await contract.getPoolInfo(TEST_POOL_ID);
    const mintPrice = poolInfo.mintPrice;
    
    console.log(`Attempting to mint from pool ${TEST_POOL_ID} on ${chainName}`);
    console.log(`Mint price: ${ethers.formatUnits(mintPrice, 18)} ETH`);
    
    // Check if already minted
    const mintCount = await contract.getUserMintCount(signer.address, TEST_POOL_ID);
    if (mintCount > 0) {
      console.log(`Already minted ${mintCount} tokens from pool ${TEST_POOL_ID} on ${chainName}`);
      return;
    }
    
    // Execute mint transaction
    console.log(`Executing mint transaction on ${chainName}...`);
    
    const tx = await contract.mintFromPool(
      TEST_POOL_ID, 
      {
        value: mintPrice,
        gasLimit: GAS_SETTINGS[chainName.toLowerCase()].gasLimit,
        maxFeePerGas: GAS_SETTINGS[chainName.toLowerCase()].maxFeePerGas,
        maxPriorityFeePerGas: GAS_SETTINGS[chainName.toLowerCase()].maxPriorityFeePerGas
      }
    );
    
    console.log(`Mint transaction submitted on ${chainName}: ${tx.hash}`);
    console.log("Waiting for transaction confirmation...");
    
    const receipt = await tx.wait();
    console.log(`Mint transaction confirmed on ${chainName} in block ${receipt.blockNumber}`);
    
    // Check for PoolMinted event
    const mintEvents = receipt.logs
      .filter(log => log.topics[0] === ethers.id("PoolMinted(address,uint8,uint256,uint256)"))
      .map(log => {
        const parsedLog = contract.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        return {
          user: parsedLog.args[0],
          poolId: parsedLog.args[1],
          amount: parsedLog.args[2],
          timestamp: parsedLog.args[3]
        };
      });
    
    if (mintEvents.length > 0) {
      console.log(`✅ Mint successful on ${chainName}`);
      console.log(`- User: ${mintEvents[0].user}`);
      console.log(`- Pool ID: ${mintEvents[0].poolId}`);
      console.log(`- Amount: ${ethers.formatUnits(mintEvents[0].amount, 18)}`);
    } else {
      console.log(`⚠️ No mint event found in transaction receipt on ${chainName}`);
    }
    
    // Check for CrossChainMintSynced event
    const syncEvents = receipt.logs
      .filter(log => log.topics[0] === ethers.id("CrossChainMintSynced(address,uint8,uint32)"))
      .map(log => {
        const parsedLog = contract.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        return {
          user: parsedLog.args[0],
          poolId: parsedLog.args[1],
          srcEid: parsedLog.args[2]
        };
      });
    
    if (syncEvents.length > 0) {
      console.log(`✅ Cross-chain sync event emitted on ${chainName}`);
      console.log(`- User: ${syncEvents[0].user}`);
      console.log(`- Pool ID: ${syncEvents[0].poolId}`);
      console.log(`- Source EID: ${syncEvents[0].srcEid}`);
    } else {
      console.log(`ℹ️ No cross-chain sync event found in transaction receipt on ${chainName}`);
    }
    
  } catch (error) {
    console.error(`Error minting on ${chainName}:`, error.message);
    
    // Check if error is due to already minted
    if (error.message.includes("AlreadyMinted") || error.message.includes("MintLimitExceeded")) {
      console.log(`⚠️ Mint failed because user has already minted or exceeded limit on ${chainName}`);
    } 
    // Check if error is due to not being whitelisted
    else if (error.message.includes("NotWhitelisted")) {
      console.log(`⚠️ Mint failed because user is not whitelisted for pool ${TEST_POOL_ID} on ${chainName}`);
    }
    // Check if error is due to insufficient payment
    else if (error.message.includes("InsufficientPayment")) {
      console.log(`⚠️ Mint failed due to insufficient payment on ${chainName}`);
    }
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
