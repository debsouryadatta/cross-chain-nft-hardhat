// Script to fund contracts with ETH for LayerZero fees
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load configuration
const { accounts } = require("../config");
const { INFURA_API_KEY, BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require("../env");
const privateKey = accounts[0];

// Chain configurations
const CHAINS = {
    base: {
        name: 'base',
        rpc: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
        contractAddress: BASE_DEPLOYED_CONTRACT_ADDRESS,
        eid: 30184
    },
    optimism: {
        name: 'optimism',
        rpc: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
        contractAddress: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS,
        eid: 30111
    }
};

// Load ABI
const abi = require('./abi.json');

// Setup chain with provider, signer, and contract
async function setupChain(chain) {
    console.log(`Setting up ${chain.name} chain...`);
    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const signer = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(chain.contractAddress, abi, signer);
    
    return {
        name: chain.name,
        provider,
        signer,
        contract,
        eid: chain.eid
    };
}

// Fund contract with ETH
async function fundContract(chain, amount) {
    try {
        const userAddress = await chain.signer.getAddress();
        console.log(`Funding ${chain.name} contract with ${amount} ETH...`);
        
        // Check current balances
        const userBalance = await chain.provider.getBalance(userAddress);
        const contractBalance = await chain.provider.getBalance(chain.contract.target);
        
        console.log(`User balance on ${chain.name}: ${ethers.formatEther(userBalance)} ETH`);
        console.log(`Contract balance on ${chain.name}: ${ethers.formatEther(contractBalance)} ETH`);
        
        // Send ETH to contract
        const tx = await chain.signer.sendTransaction({
            to: chain.contract.target,
            value: ethers.parseEther(amount)
        });
        
        console.log(`Transaction submitted. Tx hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Check new contract balance
        const newContractBalance = await chain.provider.getBalance(chain.contract.target);
        console.log(`New contract balance on ${chain.name}: ${ethers.formatEther(newContractBalance)} ETH`);
        
        return true;
    } catch (error) {
        console.error(`Error funding contract on ${chain.name}:`, error.message);
        return false;
    }
}

// Main function
async function main() {
    try {
        console.log("Starting contract funding for LayerZero fees...");
        
        // Setup chains
        const baseChain = await setupChain(CHAINS.base);
        const optimismChain = await setupChain(CHAINS.optimism);
        
        // Fund contracts with 0.003 ETH each (around 0.6-0.7 USD)
        // Increased from previous 0.0009 ETH based on diagnostic results
        const fundAmount = "0.0001";
        
        console.log("\n=== FUNDING CONTRACTS ===");
        await fundContract(baseChain, fundAmount);
        await fundContract(optimismChain, fundAmount);
        
        console.log("\nFunding complete!");
    } catch (error) {
        console.error("Error in main function:", error);
    }
}

// Run the script
main().catch(console.error);
