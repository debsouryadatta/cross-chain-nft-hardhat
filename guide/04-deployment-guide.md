# 🚀 Deployment Guide - From Code to Live Contract

## 📖 Overview

This guide walks you through deploying the `SimpleTokenCrossChainMint` contract across multiple blockchain networks. Think of deployment like opening your restaurant in different cities - each location is independent but connected!

## 🛠️ Prerequisites

### Required Tools
```bash
# Node.js and npm (check versions)
node --version  # Should be v16 or higher
npm --version   # Should be v8 or higher

# Install project dependencies
npm install
# or
pnpm install
```

### Required Accounts & Keys
1. **Private Key** - Your wallet's private key (keep this SECRET!)
2. **RPC URLs** - API endpoints for each blockchain
3. **API Keys** - For contract verification (optional but recommended)

## 🔧 Configuration Setup

### 1. Environment Variables (.env file)
Create a `.env` file in your project root:

```bash
# .env file (NEVER commit this to GitHub!)
PRIVATE_KEY=0x1234567890abcdef...  # Your wallet private key
INFURA_API_KEY=your_infura_key     # For RPC access
ETHERSCAN_API_KEY=your_etherscan_key # For contract verification
```

### 2. Update config.js
```javascript
// config.js
const config = {
    // Your wallet address (public)
    wallets: ["0x742d35Cc6234Ae2b4B65ACf0a6Bc89CE8C022039"],
    
    // Your private key (loaded from .env)
    accounts: [process.env.PRIVATE_KEY],
};

// Contract addresses (fill these after deployment)
const contractAddresses = {
    simpleToken: {
        optimism: "0x...",   // Fill after deploying to Optimism
        base: "0x...",       // Fill after deploying to Base
        linea: "0x...",      // Fill after deploying to Linea
        arbitrum: "0x...",   // Fill after deploying to Arbitrum
    }
};
```

### 3. Network Configuration
Your `hardhat.config.js` already includes network configurations:

```javascript
networks: {
    // TESTNETS (for testing)
    bscTestnet: {
        url: "https://bsc-testnet.infura.io/v3/fb3cdf3731084c2eb1f732b9b889ae70",
        accounts, // Your private key
        chainId: 97,
    },
    baseSepolia: {
        url: "https://sepolia.base.org",
        accounts,
        chainId: 84532,
    },
    
    // MAINNETS (for production)
    optimism: {
        url: "https://optimism-mainnet.infura.io/v3/fb3cdf3731084c2eb1f732b9b889ae70",
        accounts,
        chainId: 10,
    },
    base: {
        url: "https://base-mainnet.infura.io/v3/fb3cdf3731084c2eb1f732b9b889ae70",
        accounts,
        chainId: 8453,
    },
    // ... more networks
}
```

## 🎯 Step-by-Step Deployment

### Step 1: Test on Testnets First! 🧪

**Always start with testnets before mainnet!**

#### Deploy to BSC Testnet:
```bash
# Deploy contract
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network bscTestnet --verify

# Expected output:
# ✅ SimpleTokenCrossChainMint deployed to: 0x1234...
# ✅ Contract verified on BSCScan
```

#### Deploy to Base Sepolia:
```bash
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network baseSepolia --verify
```

#### What Happens During Deployment:
1. **Compilation** - Solidity code → Bytecode
2. **Gas Estimation** - Calculate deployment cost
3. **Transaction** - Send deployment transaction
4. **Confirmation** - Wait for blockchain confirmation
5. **Verification** - Upload source code to block explorer

### Step 2: Update Configuration

After successful testnet deployments, update your config:

```javascript
// config.js - Add your deployed addresses
const contractAddresses = {
    simpleToken: {
        bscTestnet: "0x1234...",     // Your BSC testnet address
        baseSepolia: "0x5678...",    // Your Base sepolia address
    }
};
```

### Step 3: Set Up LayerZero Peers

Connect your contracts so they can communicate:

```bash
# Run the peer setup script
node scripts/setup-peers.js
```

Or manually using the setpeer.js script:
```javascript
// Set BSC Testnet → Base Sepolia connection
await set_peer("bscTestnet", "baseSepolia");

// Set Base Sepolia → BSC Testnet connection  
await set_peer("baseSepolia", "bscTestnet");
```

### Step 4: Test Cross-Chain Functionality

```bash
# Run comprehensive tests
npx hardhat run scripts/multichain-test.js --network bscTestnet
```

This script will:
1. ✅ Deploy contracts (if not already deployed)
2. ✅ Set up LayerZero peers
3. ✅ Test minting on one chain
4. ✅ Verify sync on other chains
5. ✅ Test cross-chain transfers

## 🌐 Mainnet Deployment

### Step 1: Get Mainnet Funds

You need native tokens for gas fees:
- **Optimism**: OP or ETH
- **Base**: ETH
- **Linea**: ETH  
- **Arbitrum**: ETH
- **Polygon**: MATIC
- **BSC**: BNB

### Step 2: Deploy to First Mainnet

Start with one chain, test thoroughly, then expand:

```bash
# Deploy to Optimism first
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network optimism --verify

# Expected output:
# ✅ SimpleTokenCrossChainMint deployed to: 0xabcd...
# ✅ Contract verified on Optimistic Etherscan
```

### Step 3: Deploy to Additional Chains

```bash
# Deploy to Base
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network base --verify

# Deploy to Linea  
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network linea --verify

# Deploy to Arbitrum
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network arbitrum --verify
```

### Step 4: Update Production Config

```javascript
// config.js - Production addresses
const contractAddresses = {
    simpleToken: {
        optimism: "0xabcd...",   // Your Optimism address
        base: "0xefgh...",       // Your Base address  
        linea: "0xijkl...",      // Your Linea address
        arbitrum: "0xmnop...",   // Your Arbitrum address
    }
};
```

## 🔗 Post-Deployment Setup

### 1. Set LayerZero Peers

**Critical Step!** Connect all contracts:

```bash
# Run the comprehensive peer setup
node scripts/setup-all-peers.js
```

This connects all contracts in both directions:
```
Optimism ←→ Base
Optimism ←→ Linea  
Optimism ←→ Arbitrum
Base ←→ Linea
Base ←→ Arbitrum
Linea ←→ Arbitrum
```

### 2. Configure Gas Limits

Set appropriate gas limits for each destination:

```bash
# Through Hardhat console or script
await contract.setGasLimit(BASE_EID, 200000);      // Base
await contract.setGasLimit(LINEA_EID, 250000);     // Linea (higher gas)
await contract.setGasLimit(ARBITRUM_EID, 300000);  // Arbitrum (different model)
await contract.setGasLimit(OPTIMISM_EID, 200000);  // Optimism
```

### 3. Fund Contracts for LayerZero Fees

Each contract needs native tokens to pay LayerZero fees:

```bash
# Send ETH to each contract for LayerZero fees
# Recommended: 0.01-0.1 ETH per contract depending on expected usage

# Example: Fund Optimism contract
npx hardhat run scripts/fund-contract.js --network optimism
```

### 4. Enable Pools

Pools are disabled by default. Enable them when ready:

```bash
# Enable all pools on all chains
npx hardhat run scripts/enable-pools.js --network optimism
npx hardhat run scripts/enable-pools.js --network base
npx hardhat run scripts/enable-pools.js --network linea
npx hardhat run scripts/enable-pools.js --network arbitrum
```

Or enable specific pools:
```javascript
// Enable only Pool 1 (freemint) initially
await contract.enablePool(1);

// Later, enable whitelisted pools
await contract.enablePool(2);
await contract.enablePool(3);

// Finally, enable public pool
await contract.enablePool(4);
```

## 🧪 Deployment Verification

### 1. Check Contract Addresses

Verify all contracts deployed correctly:

```bash
# Check each network's deployment
npx hardhat verify --network optimism <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
npx hardhat verify --network base <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### 2. Test Basic Functions

```javascript
// Test basic contract functionality
const contract = await ethers.getContractAt("SimpleTokenCrossChainMint", contractAddress);

// Check owner
const owner = await contract.owner();
console.log("Owner:", owner);

// Check pools
const poolInfo = await contract.getPoolInfo(1);
console.log("Pool 1:", poolInfo);

// Check LayerZero endpoint
const endpoint = await contract.endpoint();
console.log("Endpoint:", endpoint);
```

### 3. Test Cross-Chain Communication

```bash
# Run the comprehensive test suite
npx hardhat run scripts/test-all-chains.js
```

This will:
1. ✅ Test mint on Chain A
2. ✅ Verify sync on Chains B, C, D
3. ✅ Test cross-chain transfer A→B
4. ✅ Test cross-chain transfer B→C
5. ✅ Verify balances on all chains

## 🔍 Troubleshooting

### Common Issues:

#### 1. **"Insufficient funds for gas"**
```bash
# Solution: Add more native tokens to deployer wallet
# Check balance: npx hardhat run scripts/check-balance.js --network optimism
```

#### 2. **"Contract verification failed"**
```bash
# Solution: Manually verify on block explorer
# Or retry with --force flag
npx hardhat verify --network optimism <ADDRESS> --force
```

#### 3. **"LayerZero message failed"**
```bash
# Check LayerZero explorer: https://layerzeroscan.com
# Common causes:
# - Insufficient gas limit
# - Wrong peer address  
# - Insufficient contract balance for fees
```

#### 4. **"Transaction reverted"**
```bash
# Common causes:
# - Pool not enabled
# - User not whitelisted  
# - Insufficient payment
# - User already minted

# Debug with transaction trace on block explorer
```

### Debug Commands:

```bash
# Check network connection
npx hardhat run scripts/check-network.js --network optimism

# Check contract state
npx hardhat run scripts/contract-status.js --network optimism

# Check LayerZero configuration
npx hardhat run scripts/check-lz-config.js --network optimism
```

## 📊 Deployment Costs

### Estimated Gas Costs (may vary):

| Network | Contract Deployment | Verification | Peer Setup |
|---------|-------------------|-------------|------------|
| Optimism | ~0.002 ETH | Free | ~0.001 ETH |
| Base | ~0.001 ETH | Free | ~0.0005 ETH |
| Arbitrum | ~0.005 ETH | Free | ~0.002 ETH |
| Linea | ~0.003 ETH | Free | ~0.001 ETH |
| BSC | ~0.001 BNB | Free | ~0.0005 BNB |
| Polygon | ~0.01 MATIC | Free | ~0.005 MATIC |

**Total estimated cost:** $50-200 USD (depending on gas prices)

## 🚨 Security Checklist

Before going live:

### ✅ **Code Review**
- [ ] Remove all testing functions (`resetUserMint`, etc.)
- [ ] Verify all access controls (`onlyOwner` modifiers)
- [ ] Check for reentrancy protection
- [ ] Validate input sanitization

### ✅ **Configuration Review**  
- [ ] Correct LayerZero endpoints for each network
- [ ] Proper peer addresses set
- [ ] Reasonable gas limits configured
- [ ] Appropriate pool prices set

### ✅ **Testing Checklist**
- [ ] Single-chain minting works
- [ ] Cross-chain mint prevention works
- [ ] Cross-chain transfers work
- [ ] Whitelist management works
- [ ] Admin functions work
- [ ] Emergency functions work

### ✅ **Operational Setup**
- [ ] Contracts funded for LayerZero fees
- [ ] Monitoring tools configured
- [ ] Emergency response plan ready
- [ ] Team access controls configured

## 🎯 Going Live Strategy

### Phase 1: Soft Launch
1. Deploy to 2 chains (e.g., Optimism + Base)
2. Enable only Pool 1 (freemint) 
3. Limit initial users (small whitelist)
4. Monitor for 24-48 hours

### Phase 2: Gradual Expansion  
1. Add more chains (Linea, Arbitrum)
2. Enable more pools
3. Expand whitelist
4. Increase monitoring

### Phase 3: Full Launch
1. All chains active
2. All pools enabled
3. Public minting open
4. Marketing campaign

## 🚀 Next Steps

After successful deployment:

1. **[User Guide](./06-user-guide.md)** - How users interact with your dApp
2. **[Testing Guide](./05-testing-guide.md)** - Ongoing testing procedures
3. **[Monitoring Guide](./07-monitoring-guide.md)** - Keep your system healthy

Congratulations! You've successfully deployed a cross-chain token system! 🎉

Remember: Start small, test thoroughly, and scale gradually. Cross-chain systems are powerful but require careful management. 🌟
