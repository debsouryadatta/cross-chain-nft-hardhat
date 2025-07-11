const { ethers } = require("ethers");
const abi = require ("./abi.json")
const {accounts} = require ("../config")
const rpcURL = {
    linea: "https://rpc.linea.build",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    base: "https://base.llamarpc.com",
    op: "https://mainnet.optimism.io",
  };
  
  const Contract_Addresses = {
    linea: "", 
    arbitrum: "", 
    base: "",
    op: "",
  };


  
  

const dstEid ={
    base: 30184,
    arbitrum: 30110,
    linea: 30183,
    op: 30111
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

  async function main(){

    
  await set_peer("op","base")
    
   await set_peer("base","op")
    
  
  }

  main()
  