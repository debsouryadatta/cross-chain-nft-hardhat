const { ethers } = require("ethers");
const abi = require("./abi.json");
const {accounts} = require("../config")
const { INFURA_API_KEY, BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require("../env");

// RPC URLs for each network
const rpcURL = {
    base: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
    optimism: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
}; 

// Contract addresses on each chain
const Contract_Addresses = {
    base: BASE_DEPLOYED_CONTRACT_ADDRESS,
    optimism: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS,
};

/**
 * Withdraw funds from a contract on the specified network
 * @param {string} network - The network name (base, optimism)
 */
async function withdrawFunds(network) {
    console.log(`\n=== WITHDRAWING FUNDS FROM ${network.toUpperCase()} ===`);
    
    try {
        // Setup provider and signer
        const provider = new ethers.JsonRpcProvider(rpcURL[network]);
        const signer = new ethers.Wallet(accounts[0], provider);
        const tokenAddress = Contract_Addresses[network];
        const contract = new ethers.Contract(tokenAddress, abi, signer);
        
        // Get owner address
        const ownerAddress = await contract.owner();
        const signerAddress = await signer.getAddress();
        
        // Check if signer is the owner
        if (ownerAddress.toLowerCase() !== signerAddress.toLowerCase()) {
            console.error(`Error: Signer (${signerAddress}) is not the contract owner (${ownerAddress})`);
            return;
        }
        
        // Get contract and owner balances before withdrawal
        const contractBalanceBefore = await provider.getBalance(tokenAddress);
        const ownerBalanceBefore = await provider.getBalance(ownerAddress);
        
        console.log(`Contract balance before withdrawal: ${ethers.formatEther(contractBalanceBefore)} ETH`);
        console.log(`Owner balance before withdrawal: ${ethers.formatEther(ownerBalanceBefore)} ETH`);
        
        // Only proceed if there's a balance to withdraw
        if (contractBalanceBefore <= 0n) {
            console.log(`No funds to withdraw from ${network} contract.`);
            return;
        }
        
        // Call withdraw function
        console.log(`Calling withdraw function...`);
        const tx = await contract.withdraw({
            gasLimit: 500000,
        });
        
        console.log(`Transaction submitted. Tx hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Get balances after withdrawal
        const contractBalanceAfter = await provider.getBalance(tokenAddress);
        const ownerBalanceAfter = await provider.getBalance(ownerAddress);
        
        console.log(`Contract balance after withdrawal: ${ethers.formatEther(contractBalanceAfter)} ETH`);
        console.log(`Owner balance after withdrawal: ${ethers.formatEther(ownerBalanceAfter)} ETH`);
        
        // Calculate the amount withdrawn
        const amountWithdrawn = ownerBalanceAfter - ownerBalanceBefore + receipt.fee;
        console.log(`Amount withdrawn (including gas): ${ethers.formatEther(amountWithdrawn)} ETH`);
        console.log(`Gas used: ${ethers.formatEther(receipt.fee)} ETH`);
        
        return true;
    } catch (error) {
        console.error(`Error withdrawing funds from ${network}:`, error.message);
        if (error.data) {
            console.error(`Error data:`, error.data);
        }
        return false;
    }
}

/**
 * Main function to withdraw funds from all contracts
 */
async function main() {
    console.log("Starting withdrawal process for all contracts...");
    
    // Withdraw from Base
    await withdrawFunds("base");
    
    // Withdraw from Optimism
    await withdrawFunds("optimism");
    
    console.log("\nWithdrawal process completed!");
}

// Run the script
main().catch(console.error);
