const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { wallets } = require("../../config");
const { 
    ethereumLZConfig, 
    sonicLZConfig, 
    lineaLZConfig, 
    optimismLZConfig, 
    baseLZConfig, 
    arbitrumLZConfig 
} = require("../../config");
require("dotenv").config();

// Simple token configuration
const NAME = "CrossChain Token";
const SYMBOL = "CCT";

// Determine LayerZero endpoint based on network
function getLZEndpoint() {
    const network = process.env.HARDHAT_NETWORK || "mainnet";
    
    switch (network) {
        case "sonic":
            return sonicLZConfig.endpoint;
        case "linea":
            return lineaLZConfig.endpoint;
        case "optimism":
            return optimismLZConfig.endpoint;
        case "base":
            return baseLZConfig.endpoint;
        case "arbitrum":
            return arbitrumLZConfig.endpoint;
        case "mainnet":
        default:
            return ethereumLZConfig.endpoint;
    }
}

const LZ_ENDPOINT = getLZEndpoint();

// Pool configuration (4 pools) - using string values
const MINT_PRICES = [
    "1000000000000",    // Pool 1: 0,000001 ETH (or S token equivalent)
    "2000000000000",    // Pool 2: 0.000002 ETH  
    "3000000000000",    // Pool 3: 0.000003 ETH
    "4000000000000"     // Pool 4: 0.000004 ETH
];

const MAX_SUPPLIES = [
    1000000,  // Pool 1: 1M tokens
    500000,   // Pool 2: 500K tokens
    300000,   // Pool 3: 300K tokens
    200000    // Pool 4: 200K tokens
];

const constructorArgs = [
    wallets[0],     // Initial owner
    NAME,           // Token name
    SYMBOL,         // Token symbol
    LZ_ENDPOINT,    // LayerZero endpoint (dummy for Sonic testing)
    MINT_PRICES,    // Mint prices for each pool
    MAX_SUPPLIES    // Max supplies for each pool
];

module.exports = buildModule("SimpleTokenCrossChainMint", (m) => {
    const simpleToken = m.contract("SimpleTokenCrossChainMint", constructorArgs);
    
    // Log deployment info
    console.log(`Deploying to network: ${process.env.HARDHAT_NETWORK || "unknown"}`);
    console.log(`LayerZero endpoint: ${LZ_ENDPOINT}`);
    console.log(`Owner: ${wallets[0]}`);
    
    return { simpleToken };
});

// Deployment commands:
// npx hardhat ignition deploy ignition/modules/SimpleToken.js --network mainnet
// npx hardhat ignition deploy ignition/modules/SimpleToken.js --network sonic