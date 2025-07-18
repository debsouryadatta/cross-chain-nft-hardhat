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
	endpoint: "0x1a44076050125825900e736c501f859c50fE728c", // LayerZero Ethereum endpoint
	endpointId: 30101, // Ethereum mainnet EID
	erc20: "", // To be deployed on Ethereum
	ca: "", // To be deployed on Ethereum
	sendLib: "", // Update with actual Ethereum send library
	receiveLib: "", // Update with actual Ethereum receive library
};

const sonicLZConfig = {
	endpoint: "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B", // Sonic endpoint
	endpointId: 30332, // Sonic LayerZero EID
	erc20: "", // To be deployed on Sonic
	ca: "", // To be deployed on Sonic
	sToken: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // Wrapped S token address
	sendLib: "", // Update with actual Sonic send library
	receiveLib: "", // Update with actual Sonic receive library
};

const lineaLZConfig = {
	endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
	endpointId: 30183,
	erc20: "0xbC790b569a46Df918Fb425aF6fE4dE0513d4daed",
	ca: "0xbC790b569a46Df918Fb425aF6fE4dE0513d4daed",
	sendLib: "0x32042142DD551b4EbE17B6FEd53131dd4b4eEa06",
	receiveLib: "0xE22ED54177CE1148C557de74E4873619e6c6b205",
};

const optimismLZConfig = {
	endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
	endpointId: 30111,
	erc20: "0xB4fF660ebd25a15E2b9cF3557d9D0288298B9A74",
	ca: "0xB4fF660ebd25a15E2b9cF3557d9D0288298B9A74",
	sendLib: "0x1322871e4ab09Bc7f5717189434f97bBD9546e95",
	receiveLib: "0x3c4962Ff6258dcfCafD23a814237B7d6Eb712063",
};

const baseLZConfig = {
	endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
	endpointId: 30184,
	erc20: "0xB0f9321f21950989dAdaDD007729F13c640d0353",
	ca: "0xB0f9321f21950989dAdaDD007729F13c640d0353",
	sendLib: "0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2",
	receiveLib: "0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf",
};

const arbitrumLZConfig = {
	endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
	endpointId: 30110,
	erc20: "0xF1B00987f8b251CD640769031beecBb9690E4804",
	ca: "0xF1B00987f8b251CD640769031beecBb9690E4804",
	sendLib: "0x975bcD720be66659e3EB3C0e4F1866a3020E493A",
	receiveLib: "0x7B9E184e07a6EE1aC23eAe0fe8D6Be2f663f05e6",
};

module.exports = {
	...config,
	contractAddresses,
	ethereumLZConfig,
	sonicLZConfig,
	lineaLZConfig,
	optimismLZConfig,
	baseLZConfig,
	arbitrumLZConfig
};
