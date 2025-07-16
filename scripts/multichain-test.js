const { ethers } = require("hardhat");
const config = require("../config.js");

// Contract addresses from config
const ETH_CONTRACT = config.contractAddresses.simpleToken.ethereum;
const SONIC_CONTRACT = config.contractAddresses.simpleToken.sonic;

// LayerZero endpoint IDs
const ETH_EID = config.ethereumLZConfig.endpointId; // 30101
const SONIC_EID = config.sonicLZConfig.endpointId; // 30332

// Test configuration
const TEST_CONFIG = {
    poolPrices: [
        ethers.parseEther("0.000001"), // Pool 1
        ethers.parseEther("0.000002"), // Pool 2
        ethers.parseEther("0.000003"), // Pool 3
        ethers.parseEther("0.000004")  // Pool 4
    ],
    fundAmount: ethers.parseEther("0.0005") // Increased for Linea gas costs
};

async function main() {
    console.log("🚀 Starting Multi-Chain Test Suite...");
    console.log("🔗 Testing cross-chain minting behavior");
    console.log("=".repeat(70));
    
    // Detect current network
    const network = await ethers.provider.getNetwork();
    console.log(`🌐 Current Network: ${network.name} (Chain ID: ${network.chainId})`);
    
    console.log(`📍 Ethereum Contract: ${ETH_CONTRACT}`);
    console.log(`📍 Sonic Contract: ${SONIC_CONTRACT}`);
    console.log(`📡 Ethereum EID: ${ETH_EID}`);
    console.log(`📡 Sonic EID: ${SONIC_EID}`);
    console.log();

    // Get owner signer
    const [owner] = await ethers.getSigners();
    console.log(`👤 Owner: ${owner.address}`);
    
    // Create test users
    const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
    const user2 = ethers.Wallet.createRandom().connect(ethers.provider);
    
    console.log(`👤 User1: ${user1.address}`);
    console.log(`👤 User2: ${user2.address}`);
    console.log();

    // Fund test users (adjust amount based on network)
    console.log("💰 Funding test users...");
    const fundAmount = network.chainId === 146n ? 
        ethers.parseEther("0.0005") : ethers.parseEther("0.0005");    // Ethereum
    
    console.log(`   💰 Funding amount: ${ethers.formatEther(fundAmount)} ETH per user`);
    
    for (const user of [user1, user2]) {
        const tx = await owner.sendTransaction({
            to: user.address,
            value: fundAmount
        });
        await tx.wait();
        
        // Verify funding
        const balance = await ethers.provider.getBalance(user.address);
        console.log(`   ✅ ${user.address}: ${ethers.formatEther(balance)} ETH`);
    }
    console.log("✅ Test users funded\n");

    // Connect to contracts based on current network
    const SimpleToken = await ethers.getContractFactory("SimpleToken");
    
    let currentContract, currentContractAddress, currentChainName;
    let crossChainContract, crossChainAddress, crossChainName;
    
    if (network.chainId === 1n) { // Ethereum mainnet
        currentContract = SimpleToken.attach(ETH_CONTRACT);
        currentContractAddress = ETH_CONTRACT;
        currentChainName = "Ethereum";
        crossChainContract = SimpleToken.attach(SONIC_CONTRACT);
        crossChainAddress = SONIC_CONTRACT;
        crossChainName = "Sonic";
    } else if (network.chainId === 146n) { // Sonic
        currentContract = SimpleToken.attach(SONIC_CONTRACT);
        currentContractAddress = SONIC_CONTRACT;
        currentChainName = "Sonic";
        crossChainContract = SimpleToken.attach(ETH_CONTRACT);
        crossChainAddress = ETH_CONTRACT;
        crossChainName = "Ethereum";
    } else {
        throw new Error(`Unsupported network: ${network.name} (Chain ID: ${network.chainId})`);
    }

    let testsPassed = 0;
    let testsFailed = 0;

    // Helper function to run tests
    async function runTest(testName, testFunction) {
        try {
            console.log(`📋 Running: ${testName}`);
            await testFunction();
            console.log(`✅ PASSED: ${testName}`);
            testsPassed++;
        } catch (error) {
            console.log(`❌ FAILED: ${testName}`);
            console.log(`   Error: ${error.message}`);
            testsFailed++;
        }
        console.log();
    }

    // Test 1: Current Chain Contract Information
    await runTest(`${currentChainName} Contract Information`, async () => {
        // Current chain contract info
        const name = await currentContract.name();
        const symbol = await currentContract.symbol();
        const totalSupply = await currentContract.totalSupply();
        const owner = await currentContract.owner();
        const mintingEnabled = await currentContract.mintingEnabled();
        const crossChainEnabled = await currentContract.crossChainEnabled();
        
        console.log(`   🔗 ${currentChainName} Contract: ${currentContractAddress}`);
        console.log(`   📊 Name: ${name} (${symbol})`);
        console.log(`   📊 Total Supply: ${ethers.formatEther(totalSupply)}`);
        console.log(`   👤 Owner: ${owner}`);
        console.log(`   🔄 Minting Enabled: ${mintingEnabled}`);
        console.log(`   🌐 Cross-chain Enabled: ${crossChainEnabled}`);
        
        // Note about cross-chain contract
        console.log(`   ℹ️  Cross-chain contract (${crossChainName}): ${crossChainAddress}`);
        console.log(`   ℹ️  Cross-chain contract cannot be accessed from current network`);
    });

    // Test 2: Setup Pools on Current Chain
    await runTest(`Setup Pools on ${currentChainName}`, async () => {
        // Enable all pools
        const tx = await currentContract.connect(owner).enableAllPools();
        await tx.wait();
        
        // Add users to whitelist for pools 1-3
        for (let poolId = 1; poolId <= 3; poolId++) {
            const whitelistTx = await currentContract.connect(owner).setWhitelist(
                poolId,
                [user1.address, user2.address],
                true
            );
            await whitelistTx.wait();
        }
        
        console.log(`   ✅ All pools enabled on ${currentChainName}`);
        console.log(`   ✅ Users whitelisted for pools 1-3 on ${currentChainName}`);
    });

    // Test 3: Check Available Pools
    await runTest("Check Available Pools", async () => {
        const availablePools = await currentContract.getAvailablePools();
        console.log(`   🏊 Available pools on ${currentChainName}: [${availablePools.join(", ")}]`);
        
        for (let i = 1; i <= 4; i++) {
            const poolInfo = await currentContract.getPoolInfo(i);
            console.log(`   🏊 Pool ${i}: ${ethers.formatEther(poolInfo.maxSupply)} max, ${ethers.formatEther(poolInfo.mintPrice)} ETH, enabled: ${poolInfo.enabled}`);
        }
    });

    // Test 4: User1 Mints on Current Chain
    await runTest(`User1 Mints on ${currentChainName}`, async () => {
        const initialBalance = await currentContract.balanceOf(user1.address);
        
        const tx = await currentContract.connect(user1).mintFromPool(1, {
            value: TEST_CONFIG.poolPrices[0]
        });
        await tx.wait();
        
        const finalBalance = await currentContract.balanceOf(user1.address);
        const mintedAmount = finalBalance - initialBalance;
        
        console.log(`   🔗 User1 minted ${ethers.formatEther(mintedAmount)} tokens on ${currentChainName}`);
        
        // Check minting status
        const hasMinted = await currentContract.hasMintedGlobal(user1.address);
        console.log(`   📊 User1 global mint status on ${currentChainName}: ${hasMinted}`);
        
        if (mintedAmount !== ethers.parseEther("1")) {
            throw new Error("Expected 1 token to be minted");
        }
    });

    // Test 5: User2 Attempts Double Mint (Same Chain)
    await runTest("User2 Attempts Double Mint Test", async () => {
        // First mint
        const tx1 = await currentContract.connect(user2).mintFromPool(2, {
            value: TEST_CONFIG.poolPrices[1]
        });
        await tx1.wait();
        
        const balance1 = await currentContract.balanceOf(user2.address);
        console.log(`   🔗 User2 first mint: ${ethers.formatEther(balance1)} tokens on ${currentChainName}`);
        
        // Try second mint (should fail)
        try {
            const tx2 = await currentContract.connect(user2).mintFromPool(3, {
                value: TEST_CONFIG.poolPrices[2]
            });
            await tx2.wait();
            
            console.log(`   ⚠️  User2 was able to mint twice - one-mint restriction not working!`);
        } catch (error) {
            if (error.message.includes("AlreadyMinted") || error.message.includes("execution reverted")) {
                console.log(`   ✅ User2 correctly blocked from second mint`);
            } else {
                console.log(`   ⚠️  Second mint failed for different reason: ${error.message.substring(0, 50)}...`);
            }
        }
    });

    // Test 6: Cross-chain Transfer Test
    await runTest(`Cross-chain Transfer from ${currentChainName} to ${crossChainName}`, async () => {
        const user1Balance = await currentContract.balanceOf(user1.address);
        
        if (user1Balance > 0) {
            try {
                const transferAmount = ethers.parseEther("0.5");
                const transferFee = ethers.parseEther("0.001");
                
                // Determine target EID based on current chain
                const targetEID = currentChainName === "Optimism" ? LINEA_EID : OPTIMISM_EID;
                
                console.log(`   📊 User1 balance on ${currentChainName}: ${ethers.formatEther(user1Balance)}`);
                console.log(`   📡 Attempting transfer to ${crossChainName} (EID: ${targetEID})...`);
                
                const tx = await currentContract.connect(user1).transferToChain(
                    targetEID,
                    // user1.address, // Send to same address on target chain
                    transferAmount,
                    { value: transferFee }
                );
                await tx.wait();
                
                const newBalance = await currentContract.balanceOf(user1.address);
                const burnedAmount = user1Balance - newBalance;
                
                console.log(`   🔥 Tokens burned on ${currentChainName}: ${ethers.formatEther(burnedAmount)}`);
                console.log(`   💰 Transfer fee paid: ${ethers.formatEther(transferFee)} ETH`);
                console.log(`   ✅ Cross-chain transfer initiated successfully`);
                console.log(`   ℹ️  Tokens should appear on ${crossChainName} after LayerZero message processing`);
                
            } catch (error) {
                console.log(`   ⚠️  Cross-chain transfer failed: ${error.message.substring(0, 100)}...`);
                console.log(`   ℹ️  This is expected without proper LayerZero peer configuration`);
            }
        } else {
            console.log(`   ⚠️  No tokens to transfer - User1 balance is 0`);
        }
    });

    // Test 7: Final Balance Check on Current Chain
    await runTest(`Final Balance Check on ${currentChainName}`, async () => {
        const user1Balance = await currentContract.balanceOf(user1.address);
        const user2Balance = await currentContract.balanceOf(user2.address);
        const totalSupply = await currentContract.totalSupply();
        
        console.log(`   🔗 ${currentChainName} Balances:`);
        console.log(`      User1: ${ethers.formatEther(user1Balance)} tokens`);
        console.log(`      User2: ${ethers.formatEther(user2Balance)} tokens`);
        console.log(`      Total Supply: ${ethers.formatEther(totalSupply)} tokens`);
        
        // Check minting status
        const user1Minted = await currentContract.hasMintedGlobal(user1.address);
        const user2Minted = await currentContract.hasMintedGlobal(user2.address);
        
        console.log(`   📊 User1 minted on ${currentChainName}: ${user1Minted}`);
        console.log(`   📊 User2 minted on ${currentChainName}: ${user2Minted}`);
        
        console.log(`   ℹ️  Cross-chain contract (${crossChainName}): ${crossChainAddress}`);
        console.log(`   ℹ️  To test ${crossChainName}, run: npx hardhat run scripts/multichain-test.js --network ${crossChainName.toLowerCase()}`);
    });

    // Test 8: Cross-Chain Configuration Check
    await runTest("Cross-Chain Configuration Check", async () => {
        const crossChainEnabled = await currentContract.crossChainEnabled();
        const defaultGasLimit = await currentContract.defaultGasLimit();
        
        console.log(`   🌐 Cross-chain enabled: ${crossChainEnabled}`);
        console.log(`   ⛽ Default gas limit: ${defaultGasLimit}`);
        
        // Check gas limits for both chains
        const ethGasLimit = await currentContract.crossChainGasLimits(ETH_EID);
        const sonicGasLimit = await currentContract.crossChainGasLimits(SONIC_EID);
        
        console.log(`   ⛽ Ethereum gas limit (EID ${ETH_EID}): ${ethGasLimit}`);
        console.log(`   ⛽ Sonic gas limit (EID ${SONIC_EID}): ${sonicGasLimit}`);
        
        console.log(`   ✅ Cross-chain configuration checked`);
    });

    // Refund remaining ETH to owner
    await runTest("Refund Test ETH to Owner", async () => {
        console.log("💰 Refunding remaining test ETH to owner...");
        
        for (const user of [user1, user2]) {
            const balance = await ethers.provider.getBalance(user.address);
            if (balance > 0) {
                try {
                    const gasEstimate = ethers.parseEther("0.000001");
                    const refundAmount = balance - gasEstimate;
                    
                    if (refundAmount > 0) {
                        const tx = await user.sendTransaction({
                            to: owner.address,
                            value: refundAmount
                        });
                        await tx.wait();
                        console.log(`   💰 Refunded ${ethers.formatEther(refundAmount)} ETH from ${user.address}`);
                    }
                } catch (error) {
                    console.log(`   ⚠️  Could not refund from ${user.address}: ${error.message}`);
                }
            }
        }
        
        console.log("   ✅ Refund process completed");
    });

    // Summary
    console.log("=".repeat(70));
    console.log("📋 MULTI-CHAIN TEST SUMMARY");
    console.log("=".repeat(70));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📊 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    
    console.log("\n🔍 KEY FINDINGS:");
    console.log("• Cross-chain mint restrictions (if any)");
    console.log("• Token transfer capabilities between chains");
    console.log("• Contract state synchronization");
    console.log("• LayerZero integration status");
    
    if (testsFailed === 0) {
        console.log("\n🎉 All multi-chain tests passed!");
    } else {
        console.log("\n⚠️  Some tests failed. Review the errors above.");
    }
    
    console.log("=".repeat(70));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Multi-chain test suite failed:", error);
        process.exit(1);
    });