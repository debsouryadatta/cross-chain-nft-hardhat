# 🌟 Cross-Chain Token Project - Complete Overview

## 📖 What is this project?

This is a **Cross-Chain Token** project that allows users to mint and transfer tokens across different blockchain networks using **LayerZero** technology. Think of it as a bridge that lets your tokens move between different blockchains like Ethereum, Optimism, Base, and others.

## 🎯 Key Concepts for Beginners

### What is Cross-Chain?
- **Single Chain**: Like having money only in one bank
- **Cross-Chain**: Like having money that can move between different banks seamlessly
- Your tokens can exist on multiple blockchain networks and move between them

### What is LayerZero?
LayerZero is like a postal service for blockchains. It helps different blockchain networks communicate and transfer assets between each other securely.

## 🏗️ Project Architecture

```
📦 Cross-Chain Token System
├── 🏪 Multi-Pool Minting System (4 different pools)
├── 🌉 Cross-Chain Transfer Capability
├── 🔐 Global Mint Restriction (One mint per user across ALL chains)
└── 🎭 Whitelist Management
```

## 🎯 Core Features

### 1. **Multi-Pool Minting System**
The project has 4 different "pools" (think of them as different shops):

- **Pool 1**: Free mint (no cost)
- **Pool 2**: WL GTD (Whitelist Guaranteed) 
- **Pool 3**: WL FCFS (Whitelist First Come First Served)
- **Pool 4**: Public mint (anyone can mint)

### 2. **Global Mint Restriction**
🚨 **IMPORTANT**: If you mint a token on one blockchain (like Optimism), you **CANNOT** mint on any other blockchain (like Base or Linea). This is enforced across ALL chains using LayerZero messaging.

### 3. **Cross-Chain Transfers**
After minting on one chain, you can transfer your tokens to other supported chains.

### 4. **Whitelist System**
- Pools 1-3 require you to be on a whitelist
- Pool 4 is public (no whitelist needed)
- Admins can add/remove people from whitelists

## 🌐 Supported Networks

### Testnets (for testing)
- **BSC Testnet** (Chain ID: 97)
- **Base Sepolia** (Chain ID: 84532)

### Mainnets (for real use)
- **Linea** (Chain ID: 59144)
- **Arbitrum** (Chain ID: 42161)
- **Base** (Chain ID: 8453)
- **BSC** (Chain ID: 56)
- **Polygon** (Chain ID: 137)
- **Optimism** (Chain ID: 10)

## 🔧 Technical Stack

### Smart Contracts
- **Solidity** (version 0.8.22): Programming language for smart contracts
- **OpenZeppelin**: Security-audited contract libraries
- **LayerZero**: Cross-chain messaging protocol

### Development Tools
- **Hardhat**: Development environment for Ethereum
- **Ethers.js**: Library for interacting with Ethereum
- **Ignition**: Deployment framework

## 📁 Project Structure

```
📂 Project Root
├── 📄 contracts/               # Smart contract files
│   └── SimpleTokenCrossChainMint.sol
├── 📄 scripts/                # Deployment and interaction scripts
│   ├── multichain-test.js
│   └── test-simple-token.js
├── 📄 ignition/modules/        # Deployment modules
│   └── SimpleToken.js
├── 📄 test/                   # Test files
├── 📄 guide/                  # Documentation (you're here!)
├── 📄 config.js               # Network and contract configurations
├── 📄 hardhat.config.js       # Hardhat framework configuration
└── 📄 package.json            # Project dependencies
```

## 🚀 How It Works (Simple Flow)

1. **Setup**: Deploy the contract on multiple chains
2. **Configure**: Set up LayerZero peers (connections between chains)
3. **Mint**: User mints token on one chain (gets recorded globally)
4. **Restrict**: User cannot mint on any other chain
5. **Transfer**: User can transfer tokens between chains
6. **Sync**: All chains know who has minted (via LayerZero messages)

## 💰 Cost Structure

Each pool has different minting costs:
- Pool 1: 0.000001 ETH
- Pool 2: 0.000002 ETH  
- Pool 3: 0.000003 ETH
- Pool 4: 0.000004 ETH

Plus LayerZero messaging fees for cross-chain operations.

## 🎭 User Roles

### 👤 **Regular Users**
- Can mint from enabled pools (if whitelisted for pools 1-3)
- Can transfer tokens between chains
- Limited to one mint globally across all chains

### 👑 **Admin/Owner**
- Can enable/disable pools
- Can manage whitelists
- Can set gas limits and fees
- Can reset user mint status (for testing)
- Can withdraw contract funds

## 🔍 What's Next?

Now that you understand the overview, check out these detailed guides:

1. **[Smart Contract Deep Dive](./02-smart-contract-guide.md)** - Understanding the code
2. **[LayerZero Integration](./03-layerzero-guide.md)** - How cross-chain messaging works
3. **[Deployment Guide](./04-deployment-guide.md)** - How to deploy the contracts
4. **[Testing Guide](./05-testing-guide.md)** - How to test the functionality
5. **[User Interaction Guide](./06-user-guide.md)** - How users interact with the system

## 🚨 Important Security Notes

1. **One Mint Rule**: Enforced globally across all chains
2. **Whitelist Management**: Critical for pools 1-3
3. **Cross-Chain Security**: LayerZero handles message verification
4. **Admin Functions**: Powerful - use carefully in production
5. **Testing Functions**: Must be removed before mainnet deployment

This project combines modern DeFi concepts with cross-chain technology to create a unified token experience across multiple blockchain networks! 🌟
