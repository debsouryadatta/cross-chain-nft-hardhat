require("dotenv").config();

const env = {
    // Account details (to be moved to .env)
    ADMIN_WALLET_ADDRESS: process.env.ADMIN_WALLET_ADDRESS, // Your wallet address
    ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY, // Your private key

    // API Keys (to be moved to .env)
    BSC_API_KEY: process.env.BSC_API_KEY,
    LINEA_API_KEY: process.env.LINEA_API_KEY,
    BASE_API_KEY: process.env.BASE_API_KEY,
    ARBITRUM_API_KEY: process.env.ARBITRUM_API_KEY,
    POLYGON_API_KEY: process.env.POLYGON_API_KEY,
    OPTIMISM_API_KEY: process.env.OPTIMISM_API_KEY,

    // Infura RPC URLs (to be moved to .env)
    INFURA_API_KEY: process.env.INFURA_API_KEY,

    // Smart Contract Address deployed on Sonic
    SONIC_DEPLOYED_CONTRACT_ADDRESS: process.env.SONIC_DEPLOYED_CONTRACT_ADDRESS,
};

module.exports = env;
