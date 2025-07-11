Here's the English translation of the MOT Pool System Testing Guide:

MOT Pool System Testing Guide
🎯 Overview
The contract has been updated with an independent pool system and testing functions. Each pool can be enabled/disabled separately, and users can mint from multiple different pools.

🏗️ Contract Features
Pool System
Pool 1: Freemint

Pool 2: WL GTD (Whitelist Guaranteed)

Pool 3: WL FCFS (Whitelist First Come First Served)

Pool 4: Public mint

Key Functions
enablePool(uint8) / disablePool(uint8) - Enables/disables a specific pool

enableAllPools() / disableAllPools() - Enables/disables all pools

swapEtherForTokensFromPool(uint8) - Mints from a specific pool

getAvailablePools() - Retrieves the list of available pools for minting

hasUserMintedFromPool(uint8, address) - Checks if a user has minted from a specific pool

Testing Functions (⚠️ REMOVE IN MAINNET)
resetUserMintForPool(uint8, address) - Resets a user for a specific pool

resetUserMintForAllPools(address) - Resets a user for all pools

resetAllUsersForPool(uint8) - Resets all users for a specific pool

resetAllMintData() - Resets all minting data

🧪 Testing Scripts
1. Quick Test
Bash

npx hardhat run scripts/quick-test.js --network optimism
Basic test: enable pool → mint → try to mint again → reset → mint again

2. Full Pool System Test
Bash

npx hardhat run scripts/test-pool-system.js --network optimism
Comprehensive test of all pool features

3. Pool Manager (Interactive)
Bash

# View pool status
npx hardhat run scripts/pool-manager.js status --network optimism

# Enable pool 1
npx hardhat run scripts/pool-manager.js enable 1 --network optimism

# Enable all pools
npx hardhat run scripts/pool-manager.js enable --network optimism

# Disable pool 2
npx hardhat run scripts/pool-manager.js disable 2 --network optimism

# Reset user for pool 1
npx hardhat run scripts/pool-manager.js reset 1 0x123... --network optimism

# Reset user for all pools
npx hardhat run scripts/pool-manager.js reset 0x123... --network optimism

# Check user status
npx hardhat run scripts/pool-manager.js check 0x123... --network optimism
📋 Test Scenarios
Scenario 1: Basic Pool Testing
Enable Pool 1

User mints from Pool 1

User tries to mint again (should fail)

Reset user for Pool 1

User successfully mints again

Scenario 2: Multi-Pool Testing
Enable Pool 1 and Pool 2

User mints from Pool 1

User mints from Pool 2 (should work)

User tries to mint from Pool 1 again (should fail)

Reset user for Pool 1

User mints from Pool 1 again (should work)

Scenario 3: Pool Management
Enable all pools

Multiple users mint from different pools

Check pool statistics

Reset specific users

Test again

🔧 Manual Testing Commands
Connect to Contract
JavaScript

const contract = await ethers.getContractAt("contracts/SimpleToken.sol:SimpleToken", "0x4DC799601fF8D948A5E3e8b42afb98CF87700a38");
Check Pool Status
JavaScript

const poolStatus = await contract.getPoolStatus();
const availablePools = await contract.getAvailablePools();
console.log("Pool Status:", poolStatus);
console.log("Available Pools:", availablePools);
Enable/Disable Pools
JavaScript

await contract.enablePool(1);  // Enable Pool 1
await contract.disablePool(2); // Disable Pool 2
await contract.enableAllPools(); // Enable all
Mint from Specific Pool
JavaScript

const poolInfo = await contract.poolsInfo(1);
const oracleFee = await contract.oracleFee();
const totalCost = poolInfo.mintPrice + oracleFee;

await contract.connect(user).swapEtherForTokensFromPool(1, { value: totalCost });
Reset Functions
JavaScript

await contract.resetUserMintForPool(1, userAddress);
await contract.resetUserMintForAllPools(userAddress);
await contract.resetAllMintData();
⚠️ Important Notes
Testing Functions: The reset functions are for testing only and must be removed before mainnet deployment.

Pool Numbers: Pools are numbered 1-4, not 0-3.

Mint Restrictions: Each user can only mint once per pool, but can mint from multiple different pools.

Oracle Fee: Always remember to include the oracle fee when minting.

Pool Status: Pools are disabled by default and must be enabled before minting.

