const { EndpointId } = require("@layerzerolabs/lz-definitions");
const { ADMIN_WALLET_ADDRESS, ADMIN_PRIVATE_KEY, SONIC_DEPLOYED_CONTRACT_ADDRESS, ETH_DEPLOYED_CONTRACT_ADDRESS } = require("./env");

const config = {
	wallets: [ADMIN_WALLET_ADDRESS], //address
	accounts: [ADMIN_PRIVATE_KEY],//admin private key
};

// Contract Addresses
const contractAddresses = {
	simpleToken: {
		ethereum: ETH_DEPLOYED_CONTRACT_ADDRESS || "", // Ethereum mainnet deployment
		sonic: SONIC_DEPLOYED_CONTRACT_ADDRESS || "" // Sonic chain deployment
	}
};

// Ethereum mainnet LayerZero configuration
const ethereumLZConfig = {
	endpoint: "0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675", // LayerZero Ethereum endpoint
	endpointId: 30101, // Ethereum mainnet EID
	erc20: "", // To be deployed on Ethereum
	ca: "", // To be deployed on Ethereum
	sendLib: "", // Update with actual Ethereum send library
	receiveLib: "", // Update with actual Ethereum receive library
};

const sonicLZConfig = {
	endpoint: "0x1a44076050125825900e736c501f859c50fE728c", // Sonic endpoint
	endpointId: 30332, // Sonic LayerZero EID
	erc20: "", // To be deployed on Sonic
	ca: "", // To be deployed on Sonic
	sToken: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // Wrapped S token address
	sendLib: "", // Update with actual Sonic send library
	receiveLib: "", // Update with actual Sonic receive library
};

module.exports = {
	...config,
	contractAddresses,
	ethereumLZConfig,
	sonicLZConfig
};
