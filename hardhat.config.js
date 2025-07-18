require("@nomicfoundation/hardhat-ignition-ethers");
require("@nomicfoundation/hardhat-verify");
require("@nomicfoundation/hardhat-toolbox");

const { accounts } = require("./config");
const { INFURA_API_KEY } = require("./env");

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
		// Add Etherscan API key when needed
		apiKey: {
			mainnet: "", // Add Ethereum mainnet API key when needed
		},
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
		hardhat: {
			chainId: 1, // Use Ethereum mainnet chainId as default
			// Optional: customize the settings
			gas: 8000000,
			blockGasLimit: 8000000,
			allowUnlimitedContractSize: true,
		},

		// MAINNETS

		mainnet: {
			url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 1,
		},
		sonic: {
			url: "https://rpc.soniclabs.com", // dRPC endpoint for Sonic
			accounts,
			chainId: 146,
		},
		linea: {
			url: `https://linea-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 59144,
		},
		optimism: {
			url: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 10,
		},
		base: {
			url: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 8453,
		},
		arbitrum: {
			url: `https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}`,
			accounts,
			chainId: 42161,
		},
	},
};
