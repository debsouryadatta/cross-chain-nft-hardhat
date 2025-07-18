const { ethers } = require("ethers");
const abi = require ("./abi.json");
const { accounts } = require ("../config");
const { INFURA_API_KEY } = require("../env");

// RPC URLs for all chains
const rpcURL = {
    mainnet: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
    sonic: "https://rpc.soniclabs.com",
    linea: `https://linea-mainnet.infura.io/v3/${INFURA_API_KEY}`,
    arbitrum: `https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}`,
    base: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
    optimism: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
};
  
// Fill these addresses after deployment to each chain
const Contract_Addresses = {
    mainnet: "", // Ethereum mainnet contract address
    sonic: "",   // Sonic chain contract address
    linea: "",   // Linea contract address
    arbitrum: "", // Arbitrum contract address
    base: "",     // Base contract address
    optimism: "", // Optimism contract address
};


  
  

// LayerZero Endpoint IDs for each chain
const dstEid = {
    mainnet: 30101,  // Ethereum mainnet
    sonic: 30332,    // Sonic chain
    linea: 30183,    // Linea
    arbitrum: 30110, // Arbitrum
    base: 30184,     // Base
    optimism: 30111  // Optimism
}

async function set_peer (network,network2){

   const provider = new ethers.JsonRpcProvider(rpcURL[network]);
   const signer = new ethers.Wallet(accounts[0], provider);
   const tokenAddress = Contract_Addresses[network];
   const contract = new ethers.Contract(tokenAddress, abi, signer);

   try {
    const byteadd = ethers.zeroPadValue(Contract_Addresses[network2],32)
    const transaction = await contract.setPeer(dstEid[network2],byteadd,{
      from: signer.address,
      gasLimit: 350000,
    });

    console.log(`[Success] | [${network}] set Peer to: [${network2}] | Transaction sent:`, transaction.hash);
  } catch (error) {
    console.error(`[Fail] | [${network}] set Peer to: [${network2}]| Error in transaction:`, error);
  }

  }

async function main() {
    // const chains = ["mainnet", "sonic", "linea", "arbitrum", "base", "optimism"];
    const chains = ["mainnet", "sonic"];
    
    // For each chain, set peers to all other chains
    for (const sourceChain of chains) {
        // Check if we have a contract address for this chain
        if (!Contract_Addresses[sourceChain]) {
            console.log(`Skipping ${sourceChain} as no contract address is provided`);
            continue;
        }
        
        for (const targetChain of chains) {
            // Don't set peer to itself
            if (sourceChain === targetChain) continue;
            
            // Check if we have a contract address for the target chain
            if (!Contract_Addresses[targetChain]) {
                console.log(`Skipping ${sourceChain} -> ${targetChain} as no target contract address is provided`);
                continue;
            }
            
            console.log(`Setting peer: ${sourceChain} -> ${targetChain}`);
            await set_peer(sourceChain, targetChain);
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log("All peer connections have been set!");
}

  main()
  