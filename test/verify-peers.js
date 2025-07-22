const { ethers } = require("ethers");
const abi = require("./abi.json");
const { INFURA_API_KEY, BASE_DEPLOYED_CONTRACT_ADDRESS, OPTIMISM_DEPLOYED_CONTRACT_ADDRESS } = require("../env");

// Contract addresses on each chain
const CONTRACT_ADDRESSES = {
  base: BASE_DEPLOYED_CONTRACT_ADDRESS, // Base contract address
  optimism: OPTIMISM_DEPLOYED_CONTRACT_ADDRESS, // Optimism contract address
};

// RPC URLs for each network
const RPC_URLS = {
  base: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
  optimism: `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
};

// LayerZero EIDs
const EIDs = {
  base: 30184, // Base EID
  optimism: 30111, // Optimism EID
};

async function verifyPeers() {
  console.log(
    "=== Verifying Peer Configuration Between Base and Optimism ===\n"
  );

  // Results storage
  const results = {
    base: { connected: false, peerValue: null, expectedPeerValue: null },
    optimism: { connected: false, peerValue: null, expectedPeerValue: null },
  };

  // Check peers from Base to Optimism
  console.log("Checking Base -> Optimism connection:");
  await checkPeer("base", "optimism", results);

  // Check peers from Optimism to Base
  console.log("\nChecking Optimism -> Base connection:");
  await checkPeer("optimism", "base", results);

  // Summary
  console.log("\n=== Summary ===");
  console.log(
    `Base -> Optimism: ${
      results.base.connected ? "✅ CONNECTED" : "❌ NOT CONNECTED"
    }`
  );
  console.log(
    `Optimism -> Base: ${
      results.optimism.connected ? "✅ CONNECTED" : "❌ NOT CONNECTED"
    }`
  );

  // Detailed verification
  console.log("\n=== Detailed Verification ===");

  // Base verification
  console.log("\nBase Contract:");
  console.log(`- Current peer value: ${results.base.peerValue}`);
  console.log(`- Expected peer value: ${results.base.expectedPeerValue}`);
  console.log(
    `- Match: ${
      results.base.peerValue === results.base.expectedPeerValue
        ? "✅ YES"
        : "❌ NO"
    }`
  );

  // Optimism verification
  console.log("\nOptimism Contract:");
  console.log(`- Current peer value: ${results.optimism.peerValue}`);
  console.log(`- Expected peer value: ${results.optimism.expectedPeerValue}`);
  console.log(
    `- Match: ${
      results.optimism.peerValue === results.optimism.expectedPeerValue
        ? "✅ YES"
        : "❌ NO"
    }`
  );

  // Final result
  const allCorrect =
    results.base.connected &&
    results.optimism.connected &&
    results.base.peerValue === results.base.expectedPeerValue &&
    results.optimism.peerValue === results.optimism.expectedPeerValue;

  console.log("\n=== Final Result ===");
  console.log(
    `Peer Configuration: ${
      allCorrect ? "✅ CORRECTLY SET" : "❌ INCORRECTLY SET"
    }`
  );

  if (!allCorrect) {
    console.log("\n⚠️ Issues detected with peer configuration!");
    console.log(
      "You may need to run setpeer.js again to fix the peer connections."
    );
  } else {
    console.log(
      "\n✅ Peer configuration is correct between Base and Optimism."
    );
    console.log(
      "Cross-chain messaging should work properly between these chains."
    );
  }
}

async function checkPeer(sourceChain, targetChain, results) {
  try {
    // Connect to source chain
    const provider = new ethers.JsonRpcProvider(RPC_URLS[sourceChain]);
    const sourceAddress = CONTRACT_ADDRESSES[sourceChain];
    const targetAddress = CONTRACT_ADDRESSES[targetChain];
    const contract = new ethers.Contract(sourceAddress, abi, provider);

    // Get peer value from contract
    const peerValue = await contract.peers(EIDs[targetChain]);

    // Calculate expected peer value
    const expectedPeerValue = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "address"],
        [targetAddress, sourceAddress]
      )
    );

    // Store results
    results[sourceChain].peerValue = peerValue;
    results[sourceChain].expectedPeerValue = expectedPeerValue;
    results[sourceChain].connected =
      peerValue !==
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    // Log results
    console.log(
      `- ${
        sourceChain.charAt(0).toUpperCase() + sourceChain.slice(1)
      } contract: ${sourceAddress}`
    );
    console.log(`- Target EID (${targetChain}): ${EIDs[targetChain]}`);
    console.log(`- Peer value: ${peerValue}`);
    console.log(
      `- Peer set: ${results[sourceChain].connected ? "✅ YES" : "❌ NO"}`
    );

    return results[sourceChain].connected;
  } catch (error) {
    console.error(
      `Error checking peer from ${sourceChain} to ${targetChain}:`,
      error.message
    );
    return false;
  }
}

// Execute the script
verifyPeers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
