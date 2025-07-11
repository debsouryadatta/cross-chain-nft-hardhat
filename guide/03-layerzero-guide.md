# 🌉 LayerZero Integration Guide - Cross-Chain Messaging Made Simple

## 📖 What is LayerZero?

Imagine you have different bank accounts in different countries, and you want them all to know when you make a transaction in any one of them. LayerZero is like a global banking network that keeps all your accounts synchronized!

**In blockchain terms:**
- LayerZero allows different blockchains to send messages to each other
- It's like having a universal translator between blockchain networks
- Your smart contracts can "talk" across chains securely

## 🏗️ LayerZero Architecture in Our Project

```
    Optimism Chain                     Base Chain
         📱                               📱
   [Your Contract] ←→ LayerZero ←→ [Your Contract]
         📱           Network            📱
    Linea Chain                     Arbitrum Chain
```

## 🔧 Key LayerZero Components

### 1. **Endpoint** 🎯
```javascript
// From config.js
const baseSepoliaLZConfig = {
    endpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    endpointId: EndpointId.BASESEP_V2_TESTNET,
};
```

**What it is:** Like a post office for each blockchain
**What it does:** Handles sending and receiving messages between chains

### 2. **Endpoint ID (EID)** 🆔
```javascript
const OPTIMISM_EID = 30111;
const LINEA_EID = 30183;
const BASE_EID = 30184;
const ARBITRUM_EID = 30110;
```

**What it is:** Like postal codes for different blockchains
**What it does:** Identifies which blockchain you want to send messages to

### 3. **Peers** 🤝
```solidity
mapping(uint32 => bytes32) public peers;
```

**What it is:** Like having phone contacts for other chains
**What it does:** Stores the addresses of your contract on other blockchains

## 📤 Sending Messages (OAppSender)

### The _lzSend() Function
```solidity
function _lzSend(
    uint32 _dstEid,           // Destination chain ID
    bytes memory _message,    // Your message data
    bytes memory _options,    // Gas settings
    MessagingFee memory _fee, // Payment for messaging
    address _refundAddress    // Where to send leftover payment
) internal
```

### Real Example from Our Contract
```solidity
function transferToChain(uint32 _dstEid, address _to, uint256 _amount) external payable {
    // 1. Burn tokens on current chain
    _burn(msg.sender, _amount);

    // 2. Create message data
    ActionData memory action = ActionData({
        actionType: ActionType.MintTokensForBurn,
        account: _to,
        amount: _amount
    });

    // 3. Encode message
    bytes memory message = abi.encode(action);
    
    // 4. Set gas options
    bytes memory options = OptionsBuilder.newOptions()
        .addExecutorLzReceiveOption(gasLimit, 0);
    
    // 5. Calculate fee
    MessagingFee memory fee = _quote(_dstEid, message, options, false);
    
    // 6. Send the message!
    _lzSend(_dstEid, message, options, MessagingFee(fee.nativeFee, 0), payable(msg.sender));
}
```

**Step-by-step breakdown:**
1. **Prepare data** → What do you want to tell the other chain?
2. **Encode message** → Convert data to bytes that LayerZero understands
3. **Set gas options** → How much gas should the receiving chain use?
4. **Calculate fees** → How much ETH does LayerZero charge?
5. **Send message** → Actually send it through LayerZero!

## 📥 Receiving Messages (OAppReceiver)

### The _lzReceive() Function
```solidity
function _lzReceive(
    Origin calldata _origin,    // Info about who sent the message
    bytes32 /* _guid */,        // Unique message ID
    bytes calldata _message,    // The actual message data
    address /* _executor */,    // Who executed this message
    bytes calldata /* _extraData */ // Extra data (usually empty)
) internal override
```

### Real Example from Our Contract
```solidity
function _lzReceive(
    Origin calldata _origin, 
    bytes32, 
    bytes calldata _message,
    address, 
    bytes calldata
) internal override {
    // 1. Security check - is this from a trusted source?
    bytes32 expectedPeer = peers[_origin.srcEid];
    bytes32 actualPeer = keccak256(abi.encodePacked(_origin.sender, address(this)));
    if (expectedPeer != bytes32(0) && expectedPeer != actualPeer) {
        revert InvalidAddress();
    }
    
    // 2. Decode the message
    ActionData memory action = abi.decode(_message, (ActionData));
    
    // 3. Execute the requested action
    if (action.actionType == ActionType.MintTokensForBurn) {
        _mint(action.account, action.amount);
    } else if (action.actionType == ActionType.BurnTokensForMint) {
        _burn(action.account, action.amount);
    } else if (action.actionType == ActionType.SyncMintStatus) {
        _syncMintStatus(action.account, _origin.srcEid);
    }
}
```

**Step-by-step breakdown:**
1. **Security check** → Is this message from a trusted contract?
2. **Decode message** → Convert bytes back to readable data
3. **Execute action** → Do what the message asks (mint, burn, sync)

## 🔄 Cross-Chain Mint Synchronization

This is the **COOLEST** part! Here's how the contract ensures one-mint-per-user globally:

### When Someone Mints:
```solidity
function mintFromPool(uint8 _poolId) external payable nonReentrant {
    // ... minting logic ...
    
    // Mark as minted locally
    hasMintedGlobal[msg.sender] = true;
    
    // Tell ALL other chains about this mint!
    _notifyOtherChains(msg.sender);
}
```

### The Notification Function:
```solidity
function _notifyOtherChains(address _user) internal {
    // Send to Optimism and Linea (example)
    for (uint32 i = 1; i <= 2; i++) {
        uint32 dstEid = (i == 1) ? 30111 : 30183; // Optimism : Linea
        
        // Skip if no peer configured
        if (peers[dstEid] == bytes32(0)) continue;
        
        // Create sync message
        ActionData memory action = ActionData({
            actionType: ActionType.SyncMintStatus,
            account: _user,
            amount: 0
        });
        
        bytes memory message = abi.encode(action);
        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(gasLimit, 0);
        
        MessagingFee memory fee = _quote(dstEid, message, options, false);
        
        // Send message if contract has enough balance
        if (address(this).balance >= fee.nativeFee) {
            _lzSend(dstEid, message, options, MessagingFee(fee.nativeFee, 0), payable(address(this)));
        }
    }
}
```

### When Other Chains Receive the Sync:
```solidity
function _syncMintStatus(address _user, uint32 _srcEid) internal {
    // Mark user as having minted globally
    hasMintedGlobal[_user] = true;
    mintedOnChain[_user] = _srcEid;
    
    emit CrossChainMintSynced(_user, _srcEid);
}
```

## 🔧 Setting Up LayerZero Connections

### 1. **Deploy Contracts on Multiple Chains**
```bash
# Deploy on Optimism
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network optimism

# Deploy on Base  
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network base

# Deploy on Linea
npx hardhat ignition deploy ignition/modules/SimpleToken.js --network linea
```

### 2. **Set Peers (Connect the Contracts)**
```javascript
// In setpeer.js script
async function set_peer(network, network2) {
    const provider = new ethers.JsonRpcProvider(rpcURL[network]);
    const signer = new ethers.Wallet(accounts[0], provider);
    const contract = new ethers.Contract(tokenAddress, abi, signer);

    // Convert address to bytes32 format for LayerZero
    const byteadd = ethers.zeroPadValue(Contract_Addresses[network2], 32);
    
    // Set the peer connection
    await contract.setPeer(dstEid[network2], byteadd);
}

// Example: Connect Optimism contract to Base contract
await set_peer("op", "base");
await set_peer("base", "op");
```

### 3. **Configure Gas Limits**
```solidity
// Set gas limits for each destination chain
await contract.setGasLimit(BASE_EID, 200000);    // Base chain gas limit
await contract.setGasLimit(LINEA_EID, 250000);   // Linea chain gas limit
```

## 💰 LayerZero Fees

### How Fees Work:
```solidity
function _quote(
    uint32 _dstEid,
    bytes memory _message,
    bytes memory _options,
    bool _payInLzToken
) internal view returns (MessagingFee memory)
```

**Fee calculation considers:**
- **Destination chain** → Different chains have different costs
- **Message size** → Bigger messages cost more
- **Gas limit** → More gas = higher fee
- **Network congestion** → Busy networks cost more

### Example Fee Calculation:
```javascript
// In your frontend or script
const message = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint8", "address", "uint256"],
    [1, userAddress, amount]
);

const options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);
const fee = await contract.quote(dstEid, message, options, false);

console.log(`LayerZero fee: ${ethers.formatEther(fee.nativeFee)} ETH`);
```

## 🚨 Security Considerations

### 1. **Peer Verification**
```solidity
// Always verify messages come from trusted sources
bytes32 expectedPeer = peers[_origin.srcEid];
bytes32 actualPeer = keccak256(abi.encodePacked(_origin.sender, address(this)));
if (expectedPeer != bytes32(0) && expectedPeer != actualPeer) {
    revert InvalidAddress();
}
```

### 2. **Message Validation**
```solidity
// Validate message data before acting on it
ActionData memory action = abi.decode(_message, (ActionData));
if (action.account == address(0)) revert InvalidAddress();
if (action.amount == 0 && action.actionType != ActionType.SyncMintStatus) revert InvalidAmount();
```

### 3. **Gas Limit Management**
```solidity
// Set appropriate gas limits to prevent failed executions
uint128 gasLimit = crossChainGasLimits[_dstEid] > 0 
    ? crossChainGasLimits[_dstEid] 
    : defaultGasLimit;
```

## 🔍 Debugging LayerZero Messages

### 1. **Check LayerZero Explorer**
Visit: https://layerzeroscan.com/
- Search by transaction hash
- See message status across chains
- Check for failed deliveries

### 2. **Event Monitoring**
```solidity
// Listen for these events
event CrossChainTransfer(address indexed from, address indexed to, uint256 amount, uint32 dstEid);
event CrossChainMintSynced(address indexed user, uint32 indexed srcEid);
```

### 3. **Common Issues**
- **Insufficient gas:** Message reaches destination but fails execution
- **Wrong peer setup:** Messages rejected at destination  
- **Insufficient fees:** Messages never sent
- **Network delays:** Messages take time during congestion

## 🎯 Best Practices

### ✅ **Always Test on Testnets First**
```javascript
// Test configurations
const testnetConfig = {
    bscTestnet: { chainId: 97, endpointId: EndpointId.BSC_TESTNET },
    baseSepolia: { chainId: 84532, endpointId: EndpointId.BASESEP_V2_TESTNET }
};
```

### ✅ **Set Reasonable Gas Limits**
```solidity
// Start conservative, increase if needed
mapping(uint32 => uint128) public crossChainGasLimits;
// Base: 200,000 gas
// Optimism: 200,000 gas  
// Arbitrum: 300,000 gas (different gas model)
```

### ✅ **Handle Failed Messages Gracefully**
```solidity
// Always have fallback mechanisms
if (address(this).balance >= fee.nativeFee) {
    _lzSend(dstEid, message, options, fee, payable(address(this)));
} else {
    // Log failed attempt, try later, or emit event for manual retry
    emit MessageSendFailed(dstEid, _user);
}
```

### ✅ **Monitor Contract Balances**
LayerZero charges fees in native tokens (ETH), so contracts need funding:
```solidity
function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    if (balance > 0) {
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Transfer failed");
    }
}
```

## 🎭 Testing LayerZero Integration

### Local Testing Setup:
```javascript
// In hardhat.config.js - use LayerZero testnet endpoints
networks: {
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

### Test Script Example:
```javascript
// scripts/test-cross-chain.js
async function testCrossChainMint() {
    console.log("🧪 Testing cross-chain mint synchronization...");
    
    // 1. Mint on BSC Testnet
    const bscContract = await ethers.getContractAt("SimpleTokenCrossChainMint", BSC_ADDRESS);
    await bscContract.mintFromPool(1, { value: ethers.parseEther("0.000001") });
    
    // 2. Wait for LayerZero message
    console.log("⏳ Waiting for LayerZero sync...");
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
    
    // 3. Check if Base contract knows about the mint
    const baseContract = await ethers.getContractAt("SimpleTokenCrossChainMint", BASE_ADDRESS);
    const hasMinted = await baseContract.hasMintedGlobal(userAddress);
    
    console.log(`✅ Sync successful: ${hasMinted}`);
}
```

## 🏆 Conclusion

LayerZero integration enables our token to:
1. **Maintain global state** across multiple blockchains
2. **Prevent double-minting** through cross-chain synchronization  
3. **Enable seamless transfers** between supported networks
4. **Provide unified user experience** regardless of the blockchain

The magic happens through:
- **Secure message passing** between chains
- **Automatic state synchronization** via LayerZero
- **Robust error handling** and security checks
- **Cost-effective cross-chain operations**

## 🚀 Next Steps

Now that you understand LayerZero integration:
- **[Deployment Guide](./04-deployment-guide.md)** - Deploy across multiple chains
- **[Testing Guide](./05-testing-guide.md)** - Test cross-chain functionality  
- **[User Guide](./06-user-guide.md)** - How users interact with the system

LayerZero makes the impossible possible - truly unified blockchain applications! 🌟
