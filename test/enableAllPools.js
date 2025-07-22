const { ethers } = require("hardhat");
const { BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require("../env");

// Contract addresses on each chain
const CONTRACT_ADDRESSES = {
    base: BASE_DEPLOYED_CONTRACT_ADDRESS,
    optimism: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS,
};


async function main() {
  console.log("Starting pool configuration using enableAllPools...");
  
  // Get the signer
  const [signer] = await ethers.getSigners();
  console.log("Using address:", signer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH");
  
  // Choose which network to configure (base or optimism)
  const network = process.env.NETWORK || "base";
  if (!["base", "optimism"].includes(network)) {
    throw new Error("Invalid network. Use 'base' or 'optimism'");
  }
  
  console.log(`Configuring pools on ${network} network`);
  
  // Get contract factory and attach to the deployed address
  const contractAddress = CONTRACT_ADDRESSES[network];
  const SimpleTokenCrossChainMint = await ethers.getContractFactory("SimpleTokenCrossChainMint");
  const contract = SimpleTokenCrossChainMint.attach(contractAddress);
  console.log(`Connected to contract at: ${contractAddress}`);
  
  // Check if the signer is the owner
  try {
    const owner = await contract.owner();
    console.log(`Contract owner: ${owner}`);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error(`Error: Your address (${signer.address}) is not the contract owner (${owner})`);
      console.error("You need to be the contract owner to configure pools");
      return;
    }
    console.log(`Confirmed: You are the contract owner ✅`);
  } catch (error) {
    console.error("Error checking owner:", error.message);
    // Continue anyway for testing purposes
  }
  
  // Gas settings
  const gasSettings = {
    gasLimit: 3000000,
  };
  
  // Try to get the current gas price and increase it slightly
  try {
    const feeData = await ethers.provider.getFeeData();
    if (feeData.gasPrice) {
      // Increase gas price by 20%
      gasSettings.gasPrice = feeData.gasPrice * BigInt(12) / BigInt(10);
      console.log(`Using gas price: ${ethers.formatUnits(gasSettings.gasPrice, "gwei")} gwei`);
    }
  } catch (error) {
    console.log("Could not get current gas price, using default");
  }
  
  // Configure pools
  try {
    // Check if minting is already enabled
    let mintingEnabled;
    try {
      mintingEnabled = await contract.mintingEnabled();
      console.log(`Global minting is currently ${mintingEnabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.log("Could not check mintingEnabled status:", error.message);
    }
    
    // Enable global minting if needed
    if (mintingEnabled === undefined || !mintingEnabled) {
      console.log("Enabling global minting...");
      try {
        const tx = await contract.setMintingEnabled(true, gasSettings);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("Global minting enabled ✅");
      } catch (error) {
        console.error("Error enabling global minting:", error.message);
        return;
      }
    } else {
      console.log("Global minting is already enabled ✅");
    }
    
    // Enable all pools at once - Fixed: no parameters
    console.log("\nEnabling all pools...");
    try {
      const tx = await contract.enableAllPools(gasSettings);
      console.log("Transaction hash:", tx.hash);
      await tx.wait();
      console.log("All pools enabled ✅");
    } catch (error) {
      console.error("Error enabling all pools:", error.message);
      return;
    }
    
    // Verify that pools are enabled
    try {
      const availablePools = await contract.getAvailablePools();
      console.log("Available (enabled) pools:", availablePools.map(p => p.toString()));
      
      if (availablePools.length === 0) {
        console.log("Warning: No pools are enabled after enableAllPools call");
      }
    } catch (error) {
      console.log("Could not get available pools:", error.message);
    }
    
    // Add the current user to the whitelist for pools 1-3
    for (let poolId = 1; poolId <= 3; poolId++) {
      console.log(`\nAdding your address to whitelist for pool ${poolId}...`);
      try {
        const tx = await contract.setWhitelist(poolId, [signer.address], true, gasSettings);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log(`Address added to whitelist for pool ${poolId} ✅`);
      } catch (error) {
        console.error(`Error adding address to whitelist for pool ${poolId}:`, error.message);
      }
    }
    
    console.log("\nPool configuration complete!");
    
  } catch (error) {
    console.error("Unexpected error during pool configuration:", error);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
