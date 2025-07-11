require("@nomicfoundation/hardhat-ignition-ethers");
require("@nomicfoundation/hardhat-verify");
require("@nomicfoundation/hardhat-toolbox");

const { accounts } = require("./config");
const { 
    BSC_API_KEY,
    LINEA_API_KEY,
    BASE_API_KEY,
    ARBITRUM_API_KEY,
    POLYGON_API_KEY,
    OPTIMISM_API_KEY,
    INFURA_API_KEY
} = require("./env");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: {
		version: "0.8.22",
		settings: {
			optimizer: {
				enabled: true,
				runs: 1000,
			},

			evmVersion: "paris",
		},
	},
	etherscan: {
		apiKey: {
			bscTestnet: BSC_API_KEY,
			bsc: BSC_API_KEY,
			linea: LINEA_API_KEY,
			base: BASE_API_KEY,
			arbitrumOne: ARBITRUM_API_KEY,
			polygon: POLYGON_API_KEY,
			optimism: OPTIMISM_API_KEY,
			optimisticEthereum: OPTIMISM_API_KEY,
		},

		customChains: [
			{
				network: "linea",
				chainId: 59144,
				urls: {
					apiURL: "https://api.lineascan.build/api",
					browserURL: "https://lineascan.build/",
				},
			},
		],
	},

	sourcify: {
		enabled: false,
	},
	ignition: {
		blockPollingInterval: 1_000,
		timeBeforeBumpingFees: 3 * 60 * 1_000,
		maxFeeBumps: 4,
		requiredConfirmations: 5,
		disableFeeBumping: false,
	},

	networks: {
		// TESTNETS

		hardhat: {
			chainId: 97,
			// Optional: customize the settings
			gas: 8000000,
			blockGasLimit: 8000000,
			allowUnlimitedContractSize: true,
		},

		bscTestnet: {
			url: `https://bsc-testnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 97,
		},
		baseSepolia: {
			url: "https://sepolia.base.org",
			accounts,
			chainId: 84532,
		},

		// MAINNETS

		linea: {
			url: `https://linea-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 59144,
		},

		arbitrum: {
			url: `https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 42161,
		},

		base: {
			url: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 8453,
		},

		bsc: {
			url: `https://bsc-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 56,
		},

		polygon: {
			url: `https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 137,
		},

		optimism: {
			url: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 10,
		},
	},
};
