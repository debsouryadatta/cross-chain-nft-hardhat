const { ethers } = require("ethers");
const abi = require("./abi.json");
const {accounts} = require("../config")
const { INFURA_API_KEY, BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require("../env");

const rpcURL = {
    linea: "https://rpc.linea.build",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    base: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
    optimism: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
}; 

const Contract_Addresses = {
    linea: "", 
    arbitrum: "", 
    base: BASE_DEPLOYED_CONTRACT_ADDRESS,
    optimism: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS,
};

const dstEid = {
    linea: 30183,    // Linea
    arbitrum: 30110, // Arbitrum
    base: 30184,     // Base
    optimism: 30111  // Optimism
}

async function set_peer(network, network2) {

   const provider = new ethers.JsonRpcProvider(rpcURL[network]);
   const signer = new ethers.Wallet(accounts[0], provider);
   const tokenAddress = Contract_Addresses[network];
   const contract = new ethers.Contract(tokenAddress, abi, signer);
   const targetContractAddress = Contract_Addresses[network2];

   try {
    // Create the peer value using keccak256 hash of the encoded packed addresses
    // This matches the contract's peer validation: bytes32 actualPeer = keccak256(abi.encodePacked(_origin.sender, address(this)))
    const peerValue = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'address'],
        [targetContractAddress, tokenAddress]
      )
    );
    
    console.log(`Setting peer from ${network} (${tokenAddress}) to ${network2} (${targetContractAddress})`);
    console.log(`Destination EID: ${dstEid[network2]}, Peer Value: ${peerValue}`);
    
    const transaction = await contract.setPeer(dstEid[network2], peerValue, {
      gasLimit: 500000,
    });

    console.log(`[Success] | [${network}] set Peer to: [${network2}] | Transaction sent:`, transaction.hash);
    console.log(`Waiting for transaction confirmation...`);
    const receipt = await transaction.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  } catch (error) {
    console.error(`[Fail] | [${network}] set Peer to: [${network2}]| Error in transaction:`, error);
  }

}

async function main() {
  console.log("Setting up peer connections between Base and Optimism...");
  
  // First set Base as peer for Optimism
  console.log("\n1. Setting Base as peer for Optimism contract");
  await set_peer("optimism", "base");
  
  // Then set Optimism as peer for Base
  console.log("\n2. Setting Optimism as peer for Base contract");
  await set_peer("base", "optimism");
  
  console.log("\nPeer setup process completed!");
}

main()