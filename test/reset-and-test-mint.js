// Script to reset user mint status and test cross-chain mint blocking
const fs = require('fs');
const { ethers } = require('ethers');
const { accounts } = require('../config');
const { INFURA_API_KEY, BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require('../env');

// Load ABI
const abi = JSON.parse(fs.readFileSync('./test/abi.json', 'utf8'));

// Chain configurations
const CHAINS = {
    base: {
        name: 'base',
        rpc: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
        contractAddress: BASE_DEPLOYED_CONTRACT_ADDRESS,
        chainId: 8453, // Base Mainnet
        eid: 30184 // LayerZero EID for Base
    },
    optimism: {
        name: 'optimism',
        rpc: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
        contractAddress: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS,
        chainId: 10, // Optimism Mainnet
        eid: 30111 // LayerZero EID for Optimism
    }
};

// Pool ID to test
const TEST_POOL_ID = 2;

// Setup providers and contracts
async function setupChain(chain) {
    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const wallet = new ethers.Wallet(accounts[0], provider);
    const contract = new ethers.Contract(chain.contractAddress, abi, wallet);
    
    return {
        name: chain.name,
        provider,
        signer: wallet,
        contract,
        eid: chain.eid
    };
}

// Reset user mint status
async function resetUserMint(chain) {
    try {
        console.log(`Resetting user mint status on ${chain.name}...`);
        const userAddress = await chain.signer.getAddress();
        console.log(`User address: ${userAddress}`);
        
        // Call resetUserMint function
        const tx = await chain.contract.resetUserMint(userAddress);
        console.log(`Reset transaction submitted. Tx hash: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`Reset transaction confirmed in block ${receipt.blockNumber}`);
        
        // Verify reset
        const hasMintedGlobal = await chain.contract.hasMintedGlobal(userAddress);
        console.log(`User has minted globally after reset: ${hasMintedGlobal}`);
        
        const mintedOnChain = await chain.contract.mintedOnChain(userAddress);
        console.log(`User minted on chain after reset: ${mintedOnChain}`);
        
        // Check mint count for test pool
        const mintCount = await chain.contract.getUserMintCount(userAddress, TEST_POOL_ID);
        console.log(`User mint count for pool ${TEST_POOL_ID} after reset: ${mintCount}`);
        
        return true;
    } catch (error) {
        console.error(`Error resetting user mint status on ${chain.name}:`, error.message);
        return false;
    }
}

// Check and enable pool if needed
async function checkAndEnablePool(contract, poolId, userAddress) {
    try {
        // Check if global minting is enabled
        const mintingEnabled = await contract.mintingEnabled();
        console.log(`Global minting enabled: ${mintingEnabled}`);
        
        // Check if pool is enabled
        const poolInfo = await contract.getPoolInfo(poolId);
        console.log(`Pool ${poolId} is enabled: ${poolInfo.enabled}`);
        
        // Enable pool if needed
        if (!poolInfo.enabled) {
            console.log(`Enabling pool ${poolId}...`);
            const tx = await contract.enablePool(poolId);
            await tx.wait();
            console.log(`Pool ${poolId} enabled successfully.`);
        }
        
        // Check if user is whitelisted using the whitelist mapping
        const isWhitelisted = await contract.whitelist(poolId, userAddress);
        console.log(`User ${userAddress} is whitelisted for pool ${poolId}: ${isWhitelisted}`);
        
        // Whitelist user if needed
        if (!isWhitelisted) {
            console.log(`Whitelisting user ${userAddress} for pool ${poolId}...`);
            const tx = await contract.setWhitelist(poolId, [userAddress], true);
            await tx.wait();
            console.log(`User ${userAddress} whitelisted successfully.`);
        }
    } catch (error) {
        console.error(`Error checking/enabling pool:`, error.message);
        throw error;
    }
}

// Mint from pool
async function mintFromPool(chain, poolId) {
    try {
        console.log(`\nMinting from pool ${poolId} on ${chain.name}...`);
        const userAddress = await chain.signer.getAddress();
        
        // Get pool info to determine price
        const poolInfo = await chain.contract.getPoolInfo(poolId);
        const mintPrice = poolInfo.mintPrice;
        console.log(`Pool ${poolId} mint price: ${ethers.formatEther(mintPrice)} ETH`);
        
        // Check and enable pool if needed
        await checkAndEnablePool(chain.contract, poolId, userAddress);
        
        // Get user balance before minting
        const userBalanceBefore = await chain.contract.balanceOf(userAddress);
        console.log(`User balance before mint: ${userBalanceBefore}`);
        
        // Get user mint count
        const mintCount = await chain.contract.getUserMintCount(userAddress, poolId);
        console.log(`User mint count for pool ${poolId}: ${mintCount}`);
        
        // Get pool info
        const poolInfoDetails = await chain.contract.getPoolInfo(poolId);
        console.log(`Pool ${poolId} max mints per wallet: ${poolInfoDetails.maxMintsPerWallet}`);
        console.log(`Pool ${poolId} total minted: ${poolInfoDetails.totalMinted}`);
        console.log(`Pool ${poolId} max supply: ${poolInfoDetails.maxSupply}`);
        
        // Check if user has minted globally
        const userMintInfo = await chain.contract.getUserMintInfo(userAddress);
        console.log(`User has minted globally: ${userMintInfo[0]}, on chain: ${userMintInfo[1]}`);
        
        // Try to estimate gas
        try {
            const gasEstimate = await chain.contract.mintFromPool.estimateGas(poolId, { value: mintPrice });
            console.log(`Gas estimate for mint: ${gasEstimate}`);
        } catch (error) {
            console.log(`Gas estimation failed: ${error.message}`);
            console.log('This indicates the transaction would fail. Reason:', error);
            return false;
        }
        
        // Execute mint transaction
        const tx = await chain.contract.mintFromPool(poolId, { 
            value: mintPrice,
            gasLimit: 500000 // Higher gas limit to ensure it's not a gas issue
        });
        console.log(`Mint transaction submitted. Tx hash: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`Mint transaction confirmed in block ${receipt.blockNumber}`);
        
        // Get user balance after minting
        const userBalanceAfter = await chain.contract.balanceOf(userAddress);
        console.log(`User balance after mint: ${userBalanceAfter}`);
        console.log(`Balance change: ${userBalanceAfter - userBalanceBefore}`);
        
        // Check if the transaction was successful
        if (receipt.status === 0) {
            throw new Error(`Mint transaction failed. Status: ${receipt.status}`);
        }
        
        return true;
    } catch (error) {
        console.error(`Error minting from pool ${poolId} on ${chain.name}:`, error.message);
        return false;
    }
}

// Wait for cross-chain sync (delay) and check status
async function waitForCrossChainSync(seconds, sourceChain, destChain, userAddress) {
    console.log(`\nWaiting ${seconds} seconds for cross-chain message to propagate...`);
    
    // Check initial state on destination chain
    console.log(`\nInitial state on ${destChain.name} before waiting:`);
    await checkMintStatus(destChain, userAddress);
    
    // Wait with periodic checks
    const checkInterval = 15; // Check every 15 seconds
    const totalChecks = Math.floor(seconds / checkInterval);
    
    for (let i = 1; i <= totalChecks; i++) {
        await new Promise(resolve => setTimeout(resolve, checkInterval * 1000));
        console.log(`\nCheck ${i}/${totalChecks} after ${i * checkInterval} seconds:`);
        await checkMintStatus(destChain, userAddress);
    }
    
    console.log(`\nFinal state on ${destChain.name} after ${seconds} seconds:`);
    await checkMintStatus(destChain, userAddress);
    console.log(`Wait complete.`);
}

// Check mint status on a chain
async function checkMintStatus(chain, userAddress) {
    try {
        // Check global mint status
        const hasMintedGlobal = await chain.contract.hasMintedGlobal(userAddress);
        console.log(`User has minted globally on ${chain.name}: ${hasMintedGlobal}`);
        
        // Check chain-specific mint status
        const mintedOnChain = await chain.contract.mintedOnChain(userAddress);
        console.log(`User minted on chain ID on ${chain.name}: ${mintedOnChain}`);
        
        // Check contract balance for gas fees
        const contractBalance = await chain.provider.getBalance(chain.contract.target);
        console.log(`Contract balance on ${chain.name}: ${ethers.formatEther(contractBalance)} ETH`);
        
        return { hasMintedGlobal, mintedOnChain };
    } catch (error) {
        console.error(`Error checking mint status on ${chain.name}:`, error.message);
        return { hasMintedGlobal: false, mintedOnChain: 0 };
    }
}

// Main function
async function main() {
    try {
        console.log("Starting reset and cross-chain mint test...");
        
        // Setup chains
        const baseChain = await setupChain(CHAINS.base);
        const optimismChain = await setupChain(CHAINS.optimism);
        
        // Check if peers are set correctly
        console.log("\n=== CHECKING PEER CONFIGURATION ===");
        try {
            const userAddress = await baseChain.signer.getAddress();
            
            // Check Base -> Optimism peer
            const basePeer = await baseChain.contract.peers(optimismChain.eid);
            console.log(`Base -> Optimism peer: ${basePeer}`);
            
            // Check Optimism -> Base peer
            const optimismPeer = await optimismChain.contract.peers(baseChain.eid);
            console.log(`Optimism -> Base peer: ${optimismPeer}`);
            
            if (basePeer === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
                optimismPeer === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                console.log("\n⚠️ WARNING: Peers not set correctly. Cross-chain messaging may not work!");
            } else {
                console.log("\n✅ Peers appear to be set correctly.");
            }
        } catch (error) {
            console.error("Error checking peers:", error.message);
        }
        
        // Reset user mint status on both chains
        console.log("\n=== RESETTING USER MINT STATUS ===");
        const userAddress = await baseChain.signer.getAddress();
        
        // Check initial state before reset
        console.log("\nInitial state before reset:");
        await checkMintStatus(baseChain, userAddress);
        await checkMintStatus(optimismChain, userAddress);
        
        // Reset user mint status
        await resetUserMint(baseChain);
        await resetUserMint(optimismChain);
        
        // Test 1: Mint on Base, then try to mint on Optimism (should be blocked)
        console.log("\n=== TEST 1: MINT ON BASE, THEN TRY OPTIMISM ===");
        
        // Mint on Base
        const baseMintSuccess = await mintFromPool(baseChain, TEST_POOL_ID);
        
        if (baseMintSuccess) {
            console.log("\nMint on Base was successful!");
            
            // Wait for cross-chain sync with status checks
            await waitForCrossChainSync(120, baseChain, optimismChain, userAddress); // Wait 120 seconds for cross-chain message
            
            // Try to mint on Optimism (should be blocked)
            console.log("\nTrying to mint on Optimism (should be blocked if cross-chain sync works)...");
            const optimismMintSuccess = await mintFromPool(optimismChain, TEST_POOL_ID);
            
            if (optimismMintSuccess) {
                console.log("\n❌ TEST FAILED: Was able to mint on Optimism after minting on Base!");
            } else {
                console.log("\n✅ TEST PASSED: Mint on Optimism was blocked as expected!");
            }
        } else {
            console.log("\n❌ TEST FAILED: Could not mint on Base!");
        }
        
        console.log("\nScript completed.");
    } catch (error) {
        console.error("Error in main:", error);
    }
}

// Run the script
main().catch(error => {
    console.error(error);
    process.exit(1);
});
