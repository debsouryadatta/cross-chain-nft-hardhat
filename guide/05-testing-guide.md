# 🧪 Testing Guide - Ensuring Everything Works Perfectly

## 📖 Overview

Testing a cross-chain system is like testing a network of connected restaurants - you need to make sure each location works individually AND they communicate properly with each other!

This guide covers all testing scenarios from basic functionality to complex cross-chain interactions.

## 🎯 Testing Philosophy

### Testing Pyramid for Blockchain:

```
        🔺 End-to-End Tests
       🔹🔹 Integration Tests  
    🔸🔸🔸🔸 Unit Tests
```

1. **Unit Tests** - Test individual functions
2. **Integration Tests** - Test contract interactions  
3. **End-to-End Tests** - Test full user journeys across chains

## 🛠️ Testing Environment Setup

### 1. Local Development Setup

```bash
# Install dependencies
npm install

# Start local Hardhat node (for local testing)
npx hardhat node

# In another terminal, run tests
npx hardhat test
```

### 2. Testnet Configuration

Your `hardhat.config.js` includes testnets:

```javascript
networks: {
    hardhat: {
        chainId: 97,  // Simulate BSC Testnet locally
        gas: 8000000,
        allowUnlimitedContractSize: true,
    },
    bscTestnet: {
        url: "https://bsc-testnet.infura.io/v3/your-key",
        accounts: [privateKey],
        chainId: 97,
    },
    baseSepolia: {
        url: "https://sepolia.base.org",
        accounts: [privateKey], 
        chainId: 84532,
    }
}
```

## 🧩 Unit Testing

### Basic Contract Functions

Create `test/SimpleToken.test.js`:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleTokenCrossChainMint", function () {
    let contract, owner, user1, user2;
    
    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        // Deploy contract
        const Contract = await ethers.getContractFactory("SimpleTokenCrossChainMint");
        contract = await Contract.deploy(
            owner.address,
            "Test Token",
            "TEST", 
            "0x6EDCE65403992e310A62460808c4b910D972f10f", // LZ endpoint
            ["1000000000000", "2000000000000", "3000000000000", "4000000000000"], // prices
            [1000000, 500000, 300000, 200000] // max supplies
        );
    });

    describe("Pool Management", function () {
        it("Should enable/disable pools correctly", async function () {
            // Initially pools are disabled
            const poolInfo = await contract.getPoolInfo(1);
            expect(poolInfo.enabled).to.be.false;
            
            // Enable pool 1
            await contract.enablePool(1);
            const poolInfoAfter = await contract.getPoolInfo(1);
            expect(poolInfoAfter.enabled).to.be.true;
            
            // Disable pool 1
            await contract.disablePool(1);
            const poolInfoFinal = await contract.getPoolInfo(1);
            expect(poolInfoFinal.enabled).to.be.false;
        });

        it("Should revert for invalid pool IDs", async function () {
            await expect(contract.enablePool(0)).to.be.revertedWithCustomError(contract, "InvalidPoolId");
            await expect(contract.enablePool(5)).to.be.revertedWithCustomError(contract, "InvalidPoolId");
        });
    });

    describe("Whitelist Management", function () {
        it("Should add/remove users from whitelist", async function () {
            // Initially not whitelisted
            expect(await contract.whitelist(1, user1.address)).to.be.false;
            
            // Add to whitelist
            await contract.setWhitelist(1, [user1.address], true);
            expect(await contract.whitelist(1, user1.address)).to.be.true;
            
            // Remove from whitelist
            await contract.setWhitelist(1, [user1.address], false);
            expect(await contract.whitelist(1, user1.address)).to.be.false;
        });
    });

    describe("Minting", function () {
        beforeEach(async function () {
            // Enable pool 1 and whitelist user1
            await contract.enablePool(1);
            await contract.setWhitelist(1, [user1.address], true);
        });

        it("Should mint successfully when conditions are met", async function () {
            const poolInfo = await contract.getPoolInfo(1);
            const mintPrice = poolInfo.mintPrice;
            
            // Mint from pool 1
            await expect(
                contract.connect(user1).mintFromPool(1, { value: mintPrice })
            ).to.emit(contract, "PoolMinted")
            .withArgs(user1.address, 1, ethers.parseEther("1"), anyValue);
            
            // Check balance
            expect(await contract.balanceOf(user1.address)).to.equal(ethers.parseEther("1"));
            
            // Check mint status
            expect(await contract.hasMintedGlobal(user1.address)).to.be.true;
        });

        it("Should prevent double minting", async function () {
            const poolInfo = await contract.getPoolInfo(1);
            const mintPrice = poolInfo.mintPrice;
            
            // First mint - should succeed
            await contract.connect(user1).mintFromPool(1, { value: mintPrice });
            
            // Second mint - should fail
            await expect(
                contract.connect(user1).mintFromPool(1, { value: mintPrice })
            ).to.be.revertedWithCustomError(contract, "AlreadyMinted");
        });

        it("Should prevent minting when not whitelisted", async function () {
            const poolInfo = await contract.getPoolInfo(1);
            const mintPrice = poolInfo.mintPrice;
            
            // user2 is not whitelisted
            await expect(
                contract.connect(user2).mintFromPool(1, { value: mintPrice })
            ).to.be.revertedWithCustomError(contract, "NotWhitelisted");
        });

        it("Should prevent minting with insufficient payment", async function () {
            const poolInfo = await contract.getPoolInfo(1);
            const mintPrice = poolInfo.mintPrice;
            
            await expect(
                contract.connect(user1).mintFromPool(1, { value: mintPrice - 1n })
            ).to.be.revertedWithCustomError(contract, "InsufficientPayment");
        });
    });

    describe("Admin Functions", function () {
        it("Should only allow owner to call admin functions", async function () {
            await expect(
                contract.connect(user1).enablePool(1)
            ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
            
            await expect(
                contract.connect(user1).setWhitelist(1, [user2.address], true)
            ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
        });
    });
});
```

### Run Unit Tests

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/SimpleToken.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run with coverage
npx hardhat coverage
```

## 🔗 Integration Testing

### Cross-Chain Interaction Tests

Create `test/CrossChain.test.js`:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Cross-Chain Integration", function () {
    let contractA, contractB, owner, user1;
    
    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();
        
        // Deploy two contracts to simulate different chains
        const Contract = await ethers.getContractFactory("SimpleTokenCrossChainMint");
        
        contractA = await Contract.deploy(
            owner.address, "Token A", "TKNA", 
            "0x6EDCE65403992e310A62460808c4b910D972f10f",
            ["1000000000000", "2000000000000", "3000000000000", "4000000000000"],
            [1000000, 500000, 300000, 200000]
        );
        
        contractB = await Contract.deploy(
            owner.address, "Token B", "TKNB",
            "0x6EDCE65403992e310A62460808c4b910D972f10f", 
            ["1000000000000", "2000000000000", "3000000000000", "4000000000000"],
            [1000000, 500000, 300000, 200000]
        );
        
        // Set up peers (simulate LayerZero connection)
        const peerA = ethers.zeroPadValue(await contractA.getAddress(), 32);
        const peerB = ethers.zeroPadValue(await contractB.getAddress(), 32);
        
        await contractA.setPeer(30111, peerB);  // Chain A knows about Chain B
        await contractB.setPeer(30110, peerA);  // Chain B knows about Chain A
    });

    it("Should sync mint status across chains", async function () {
        // Enable pools and whitelist user
        await contractA.enablePool(1);
        await contractA.setWhitelist(1, [user1.address], true);
        
        // Mint on Chain A
        const poolInfo = await contractA.getPoolInfo(1);
        await contractA.connect(user1).mintFromPool(1, { value: poolInfo.mintPrice });
        
        // Simulate LayerZero message delivery to Chain B
        const message = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint8", "address", "uint256"],
            [2, user1.address, 0] // ActionType.SyncMintStatus
        );
        
        const origin = {
            srcEid: 30110,
            sender: ethers.zeroPadValue(await contractA.getAddress(), 32),
            nonce: 1
        };
        
        // Manually call _lzReceive on Contract B (simulating LayerZero)
        await contractB._lzReceive(origin, ethers.ZeroHash, message, ethers.ZeroAddress, "0x");
        
        // Check that Chain B knows user1 minted
        expect(await contractB.hasMintedGlobal(user1.address)).to.be.true;
    });
});
```

## 🌐 Testnet Testing

### 1. Automated Testnet Scripts

Use the existing `multichain-test.js`:

```bash
# Test on BSC Testnet
npx hardhat run scripts/multichain-test.js --network bscTestnet

# Test on Base Sepolia  
npx hardhat run scripts/multichain-test.js --network baseSepolia
```

### 2. Manual Testnet Testing

Create `scripts/manual-test.js`:

```javascript
const { ethers } = require("hardhat");

async function manualTest() {
    console.log("🧪 Manual Testnet Testing");
    
    const [owner] = await ethers.getSigners();
    const contractAddress = "0x..."; // Your deployed contract address
    
    const contract = await ethers.getContractAt("SimpleTokenCrossChainMint", contractAddress);
    
    console.log("📋 Contract Status:");
    console.log(`Owner: ${await contract.owner()}`);
    console.log(`Name: ${await contract.name()}`);
    console.log(`Symbol: ${await contract.symbol()}`);
    
    // Test pool information
    for (let i = 1; i <= 4; i++) {
        const poolInfo = await contract.getPoolInfo(i);
        console.log(`Pool ${i}:`, {
            maxSupply: ethers.formatEther(poolInfo.maxSupply),
            mintPrice: ethers.formatEther(poolInfo.mintPrice),
            totalMinted: ethers.formatEther(poolInfo.totalMinted),
            enabled: poolInfo.enabled
        });
    }
    
    // Test user mint status
    const userAddress = owner.address;
    const [hasGlobalMint, chainMintedOn] = await contract.getUserMintInfo(userAddress);
    console.log(`User ${userAddress}:`, {
        hasGlobalMint,
        chainMintedOn: chainMintedOn.toString()
    });
}

manualTest().catch(console.error);
```

### 3. Cross-Chain Flow Testing

Create `scripts/test-cross-chain-flow.js`:

```javascript
const { ethers } = require("hardhat");
const config = require("../config");

async function testCrossChainFlow() {
    console.log("🌉 Testing Cross-Chain Flow");
    
    // Contracts on different chains
    const bscContract = await ethers.getContractAt(
        "SimpleTokenCrossChainMint", 
        config.contractAddresses.simpleToken.bscTestnet
    );
    
    const baseContract = await ethers.getContractAt(
        "SimpleTokenCrossChainMint",
        config.contractAddresses.simpleToken.baseSepolia  
    );
    
    const [owner] = await ethers.getSigners();
    
    console.log("Step 1: Check initial state");
    console.log(`BSC - Has minted: ${await bscContract.hasMintedGlobal(owner.address)}`);
    console.log(`Base - Has minted: ${await baseContract.hasMintedGlobal(owner.address)}`);
    
    console.log("\nStep 2: Mint on BSC");
    const poolInfo = await bscContract.getPoolInfo(1);
    await bscContract.mintFromPool(1, { value: poolInfo.mintPrice });
    console.log("✅ Minted on BSC");
    
    console.log("\nStep 3: Wait for LayerZero sync (30 seconds)");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log("\nStep 4: Check sync status");
    console.log(`BSC - Has minted: ${await bscContract.hasMintedGlobal(owner.address)}`);
    console.log(`Base - Has minted: ${await baseContract.hasMintedGlobal(owner.address)}`);
    
    console.log("\nStep 5: Try to mint on Base (should fail)");
    try {
        await baseContract.mintFromPool(1, { value: poolInfo.mintPrice });
        console.log("❌ ERROR: Mint succeeded when it should have failed!");
    } catch (error) {
        console.log("✅ Correctly prevented double mint");
    }
}

testCrossChainFlow().catch(console.error);
```

## 🎭 User Journey Testing

### Complete User Flow Tests

Create `scripts/test-user-journeys.js`:

```javascript
async function testUserJourneys() {
    console.log("👤 Testing Complete User Journeys");
    
    // Journey 1: New User First Mint
    await testNewUserFirstMint();
    
    // Journey 2: Cross-Chain Transfer
    await testCrossChainTransfer();
    
    // Journey 3: Whitelist User Experience
    await testWhitelistExperience();
    
    // Journey 4: Public Pool Experience
    await testPublicPoolExperience();
}

async function testNewUserFirstMint() {
    console.log("\n🎯 Journey 1: New User First Mint");
    
    const user = ethers.Wallet.createRandom().connect(ethers.provider);
    
    // 1. Fund user
    const [owner] = await ethers.getSigners();
    await owner.sendTransaction({
        to: user.address,
        value: ethers.parseEther("0.01")
    });
    
    // 2. Check eligibility
    const contract = await ethers.getContractAt("SimpleTokenCrossChainMint", contractAddress);
    const hasWhitelist = await contract.whitelist(1, user.address);
    console.log(`User whitelisted for Pool 1: ${hasWhitelist}`);
    
    if (!hasWhitelist) {
        console.log("Adding user to whitelist...");
        await contract.setWhitelist(1, [user.address], true);
    }
    
    // 3. Attempt mint
    const poolInfo = await contract.getPoolInfo(1);
    console.log(`Pool 1 price: ${ethers.formatEther(poolInfo.mintPrice)} ETH`);
    
    const tx = await contract.connect(user).mintFromPool(1, { 
        value: poolInfo.mintPrice 
    });
    
    const receipt = await tx.wait();
    console.log(`✅ Mint successful! Gas used: ${receipt.gasUsed}`);
    
    // 4. Verify results
    const balance = await contract.balanceOf(user.address);
    const hasMinted = await contract.hasMintedGlobal(user.address);
    
    console.log(`Token balance: ${ethers.formatEther(balance)}`);
    console.log(`Global mint status: ${hasMinted}`);
}

async function testCrossChainTransfer() {
    console.log("\n🌉 Journey 2: Cross-Chain Transfer");
    
    // Test transferring tokens from one chain to another
    const sourceContract = await ethers.getContractAt("SimpleTokenCrossChainMint", sourceAddress);
    const targetContract = await ethers.getContractAt("SimpleTokenCrossChainMint", targetAddress);
    
    const [user] = await ethers.getSigners();
    const transferAmount = ethers.parseEther("0.5");
    
    console.log("Initial balances:");
    console.log(`Source chain: ${ethers.formatEther(await sourceContract.balanceOf(user.address))}`);
    console.log(`Target chain: ${ethers.formatEther(await targetContract.balanceOf(user.address))}`);
    
    // Calculate LayerZero fee
    const message = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "address", "uint256"],
        [0, user.address, transferAmount] // MintTokensForBurn
    );
    
    const fee = await sourceContract.quote(targetChainEid, message, "0x", false);
    console.log(`LayerZero fee: ${ethers.formatEther(fee.nativeFee)} ETH`);
    
    // Execute transfer
    const tx = await sourceContract.transferToChain(
        targetChainEid,
        user.address,
        transferAmount,
        { value: fee.nativeFee }
    );
    
    console.log(`Transfer initiated: ${tx.hash}`);
    
    // Wait for LayerZero delivery
    console.log("Waiting for LayerZero delivery...");
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
    
    console.log("Final balances:");
    console.log(`Source chain: ${ethers.formatEther(await sourceContract.balanceOf(user.address))}`);
    console.log(`Target chain: ${ethers.formatEther(await targetContract.balanceOf(user.address))}`);
}
```

## 📊 Load Testing

### Stress Testing Pools

Create `scripts/load-test.js`:

```javascript
async function loadTestPools() {
    console.log("⚡ Load Testing Pools");
    
    const contract = await ethers.getContractAt("SimpleTokenCrossChainMint", contractAddress);
    const poolInfo = await contract.getPoolInfo(4); // Public pool
    
    // Create multiple test users
    const users = [];
    for (let i = 0; i < 10; i++) {
        const user = ethers.Wallet.createRandom().connect(ethers.provider);
        
        // Fund user
        const [owner] = await ethers.getSigners();
        await owner.sendTransaction({
            to: user.address,
            value: ethers.parseEther("0.01")
        });
        
        users.push(user);
    }
    
    // Enable public pool
    await contract.enablePool(4);
    
    // Concurrent minting test
    console.log("Testing concurrent mints...");
    const promises = users.map(async (user, index) => {
        try {
            const tx = await contract.connect(user).mintFromPool(4, {
                value: poolInfo.mintPrice
            });
            console.log(`✅ User ${index} minted: ${tx.hash}`);
            return { success: true, user: index };
        } catch (error) {
            console.log(`❌ User ${index} failed: ${error.message}`);
            return { success: false, user: index, error: error.message };
        }
    });
    
    const results = await Promise.all(promises);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\n📊 Results: ${successful} successful, ${failed} failed`);
    
    // Check pool state
    const finalPoolInfo = await contract.getPoolInfo(4);
    console.log(`Pool 4 total minted: ${ethers.formatEther(finalPoolInfo.totalMinted)}`);
}
```

## 🔍 Gas Optimization Testing

### Gas Usage Analysis

Create `scripts/gas-analysis.js`:

```javascript
async function analyzeGasUsage() {
    console.log("⛽ Gas Usage Analysis");
    
    const contract = await ethers.getContractAt("SimpleTokenCrossChainMint", contractAddress);
    const [owner, user] = await ethers.getSigners();
    
    // Test different functions
    const tests = [
        {
            name: "enablePool",
            fn: () => contract.enablePool(1)
        },
        {
            name: "setWhitelist (1 user)",
            fn: () => contract.setWhitelist(1, [user.address], true)
        },
        {
            name: "setWhitelist (10 users)",
            fn: () => contract.setWhitelist(1, Array(10).fill(user.address), true)
        },
        {
            name: "mintFromPool",
            fn: async () => {
                const poolInfo = await contract.getPoolInfo(1);
                return contract.connect(user).mintFromPool(1, { value: poolInfo.mintPrice });
            }
        },
        {
            name: "transferToChain",
            fn: async () => {
                const amount = ethers.parseEther("0.1");
                const fee = await contract.quote(30111, "0x", "0x", false);
                return contract.connect(user).transferToChain(30111, user.address, amount, {
                    value: fee.nativeFee
                });
            }
        }
    ];
    
    for (const test of tests) {
        try {
            const tx = await test.fn();
            const receipt = await tx.wait();
            console.log(`${test.name}: ${receipt.gasUsed} gas`);
        } catch (error) {
            console.log(`${test.name}: Failed - ${error.message}`);
        }
    }
}
```

## 🚨 Security Testing

### Reentrancy Testing

```javascript
// Create a malicious contract to test reentrancy protection
contract MaliciousContract {
    SimpleTokenCrossChainMint target;
    
    constructor(address _target) {
        target = SimpleTokenCrossChainMint(_target);
    }
    
    receive() external payable {
        // Try to call mintFromPool again during refund
        if (address(target).balance > 0) {
            target.mintFromPool{value: msg.value}(1);
        }
    }
    
    function attack() external payable {
        target.mintFromPool{value: msg.value}(1);
    }
}
```

### Access Control Testing

```javascript
async function testAccessControl() {
    console.log("🔐 Testing Access Control");
    
    const [owner, attacker] = await ethers.getSigners();
    const contract = await ethers.getContractAt("SimpleTokenCrossChainMint", contractAddress);
    
    const restrictedFunctions = [
        "enablePool",
        "disablePool", 
        "setWhitelist",
        "setMintingEnabled",
        "resetUserMint",
        "withdraw"
    ];
    
    for (const funcName of restrictedFunctions) {
        try {
            await contract.connect(attacker)[funcName](1, { gasLimit: 100000 });
            console.log(`❌ ${funcName}: Attacker access succeeded (BAD!)`);
        } catch (error) {
            console.log(`✅ ${funcName}: Correctly blocked attacker`);
        }
    }
}
```

## 📋 Testing Checklist

### Before Mainnet Launch:

#### ✅ **Unit Tests**
- [ ] All contract functions tested
- [ ] Edge cases covered
- [ ] Error conditions tested
- [ ] Gas usage optimized

#### ✅ **Integration Tests**
- [ ] Cross-chain communication works
- [ ] LayerZero message handling correct
- [ ] Peer setup functioning
- [ ] State synchronization working

#### ✅ **User Journey Tests**
- [ ] New user can mint successfully
- [ ] Existing user prevented from double minting
- [ ] Cross-chain transfers work
- [ ] Whitelist system functional
- [ ] Public minting works

#### ✅ **Load Tests**
- [ ] Multiple concurrent mints handled
- [ ] Contract doesn't break under stress
- [ ] Gas limits appropriate
- [ ] Error handling robust

#### ✅ **Security Tests**
- [ ] Reentrancy protection works
- [ ] Access control enforced
- [ ] Input validation prevents attacks
- [ ] No unexpected state changes

#### ✅ **Cross-Chain Tests**
- [ ] Messages sent correctly
- [ ] Messages received correctly
- [ ] Fees calculated properly
- [ ] Timeout handling works

## 🛠️ Testing Tools & Resources

### Useful Commands:
```bash
# Run specific test
npx hardhat test test/SimpleToken.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run coverage analysis
npx hardhat coverage

# Fork mainnet for testing
npx hardhat test --network hardhat

# Test on specific network
npx hardhat run scripts/test.js --network bscTestnet
```

### Debugging Tools:
- **Hardhat Console**: Interactive contract testing
- **LayerZero Scan**: Cross-chain message tracking
- **Block Explorers**: Transaction analysis
- **Tenderly**: Advanced debugging and simulation

## 🎯 Continuous Testing Strategy

### Automated Testing Pipeline:
1. **Pre-commit**: Run unit tests
2. **Pre-deployment**: Run integration tests
3. **Post-deployment**: Run end-to-end tests
4. **Ongoing**: Monitor and alert on issues

### Monitoring in Production:
- Track successful mints
- Monitor cross-chain message delivery
- Alert on failed transactions
- Track gas usage patterns

## 🚀 Next Steps

After thorough testing:
1. **[User Guide](./06-user-guide.md)** - How users interact with the system
2. **[Monitoring Guide](./07-monitoring-guide.md)** - Keep your system healthy
3. **[Troubleshooting Guide](./08-troubleshooting-guide.md)** - Handle issues when they arise

Remember: Good testing is like insurance - you hope you don't need it, but you're glad you have it when something goes wrong! 🛡️
