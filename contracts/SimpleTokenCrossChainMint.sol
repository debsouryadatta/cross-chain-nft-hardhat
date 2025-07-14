// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

/**
 * @title SimpleTokenCrossChainMint - Multi-Pool Cross-Chain Token with Per-Pool Mint Restrictions
 * @notice Different mint limits per pool type across all chains:
 *         - Pools 1-2 (Freemint & Whitelist GTD): 1 NFT per wallet globally
 *         - Pools 3-4 (Whitelist FCFS & Public): 2 NFTs per wallet globally
 * @dev Uses LayerZero to synchronize mint status across chains
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OAppSender, MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import {OAppReceiver, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppReceiver.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {OAppCore} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppCore.sol";

contract SimpleTokenCrossChainMint is ERC20, Ownable, ReentrancyGuard, OAppSender, OAppReceiver {
    using OptionsBuilder for bytes;

    // ========== STRUCTS ==========
    struct PoolInfo {
        uint256 maxSupply;
        uint256 mintPrice;
        uint256 totalMinted;
        uint256 maxMintsPerWallet;
        bool enabled;
    }

    enum ActionType {
        MintTokensForBurn,
        BurnTokensForMint,
        SyncMintStatus // NEW: Sync mint status across chains
    }

    struct ActionData {
        ActionType actionType;
        address account;
        uint256 amount;
        uint8 poolId;
    }

    // ========== EVENTS ==========
    event PoolMinted(address indexed user, uint8 indexed poolId, uint256 amount, uint256 timestamp);
    event PoolStatusChanged(uint8 indexed poolId, bool enabled);
    event AllPoolsStatusChanged(bool enabled);
    event CrossChainTransfer(address indexed from, address indexed to, uint256 amount, uint32 dstEid);
    event WhitelistUpdated(uint8 indexed poolId, address indexed account, bool status);
    event CrossChainMintSynced(address indexed user, uint8 indexed poolId, uint32 indexed srcEid); // UPDATED EVENT

    // ========== ERRORS ==========
    error InvalidPoolId();
    error PoolDisabled();
    error PoolFull();
    error InsufficientPayment();
    error AlreadyMinted();
    error MintLimitExceeded();
    error NotWhitelisted();
    error InvalidAmount();
    error InvalidAddress();
    error TransferFailed();

    // ========== STATE ==========
    uint256 public constant MAX_POOLS = 4;

    mapping(uint8 => PoolInfo) public pools;
    mapping(uint8 => mapping(address => bool)) public whitelist;
    mapping(uint8 => mapping(address => uint256)) public mintCountPerPool; // UPDATED: Track mint count per pool per user
    mapping(address => bool) public hasMintedGlobal;
    mapping(address => uint32) public mintedOnChain; // Track which chain user first minted on

    bool public mintingEnabled = true;
    bool public crossChainEnabled = true;
    uint256 public totalMaxSupply;
    uint128 public defaultGasLimit = 200000;
    mapping(uint32 => uint128) public crossChainGasLimits;

    // ========== CONSTRUCTOR ==========
    constructor(
        address _owner,
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        uint256[] memory _mintPrices,
        uint256[] memory _maxSupplies
    ) ERC20(_name, _symbol) Ownable(_owner) OAppCore(_lzEndpoint, _owner) {
        require(_mintPrices.length == MAX_POOLS && _maxSupplies.length == MAX_POOLS, "Invalid pool config");
        
        for (uint8 i = 0; i < MAX_POOLS; i++) {
            uint8 poolId = i + 1;
            uint256 maxMints = (poolId <= 2) ? 1 : 2;
            
            pools[poolId] = PoolInfo({
                maxSupply: _maxSupplies[i] * (10 ** decimals()),
                mintPrice: _mintPrices[i],
                totalMinted: 0,
                maxMintsPerWallet: maxMints,
                enabled: false
            });
            totalMaxSupply += pools[poolId].maxSupply;
        }
    }

    // ========== LAYERZERO OVERRIDES ==========
    function oAppVersion()
        public
        pure
        override(OAppSender, OAppReceiver)
        returns (uint64 senderVersion, uint64 receiverVersion)
    {
        return (1, 2);
    }

    function _lzReceive(
        Origin calldata _origin, bytes32 /* _guid */, bytes calldata _message,
        address /* _executor */, bytes calldata /* _extraData */
    ) internal override {
        // Validate that the message comes from a trusted source
        bytes32 expectedPeer = peers[_origin.srcEid];
        bytes32 actualPeer = keccak256(abi.encodePacked(_origin.sender, address(this)));
        if (expectedPeer != bytes32(0) && expectedPeer != actualPeer) {
            revert InvalidAddress();
        }
        
        ActionData memory action = abi.decode(_message, (ActionData));
        
        if (action.actionType == ActionType.MintTokensForBurn) {
            _mint(action.account, action.amount);
        } else if (action.actionType == ActionType.BurnTokensForMint) {
            _burn(action.account, action.amount);
        } else if (action.actionType == ActionType.SyncMintStatus) {
            // Handle cross-chain mint status synchronization
            _syncMintStatus(action.account, action.poolId, _origin.srcEid);
        }
    }

    // ========== CROSS-CHAIN MINT SYNC ==========
    function _syncMintStatus(address _user, uint8 _poolId, uint32 _srcEid) internal {
        // Increment the user's mint count for this pool
        mintCountPerPool[_poolId][_user] += 1;
        
        // Update global tracking
        if (!hasMintedGlobal[_user]) {
            hasMintedGlobal[_user] = true;
            mintedOnChain[_user] = _srcEid;
        }
        
        emit CrossChainMintSynced(_user, _poolId, _srcEid);
    }

    function _notifyOtherChains(address _user, uint8 _poolId) internal {
        // Send message to all configured peer chains
        for (uint32 i = 1; i <= 2; i++) { // Assuming 2 chains for now
            uint32 dstEid;
            if (i == 1) dstEid = 30111; // Optimism
            else dstEid = 30183; // Linea
            
            // Skip if this is the current chain or no peer configured
            if (peers[dstEid] == bytes32(0)) continue;
            
            ActionData memory action = ActionData({
                actionType: ActionType.SyncMintStatus,
                account: _user,
                amount: 0,
                poolId: _poolId
            });
            
            bytes memory message = abi.encode(action);
            uint128 gasLimit = crossChainGasLimits[dstEid] > 0 ? crossChainGasLimits[dstEid] : defaultGasLimit;
            bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(gasLimit, 0);
            
            // Calculate messaging fee
            MessagingFee memory fee = _quote(dstEid, message, options, false);
            
            // Send the message if contract has enough balance
            if (address(this).balance >= fee.nativeFee) {
                _lzSend(dstEid, message, options, MessagingFee(fee.nativeFee, 0), payable(address(this)));
            }
        }
    }

    // ========== WHITELIST MGMT ==========
    function setWhitelist(
        uint8 _poolId,
        address[] calldata _accounts,
        bool _status
    ) external onlyOwner {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        for (uint256 i; i < _accounts.length; i++) {
            address acc = _accounts[i];
            whitelist[_poolId][acc] = _status;
            emit WhitelistUpdated(_poolId, acc, _status);
        }
    }

    // ========== MINT WITH PER-POOL LIMITS ==========
    function mintFromPool(uint8 _poolId) external payable nonReentrant {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        if (!mintingEnabled || !pools[_poolId].enabled) revert PoolDisabled();
        if (mintCountPerPool[_poolId][msg.sender] >= pools[_poolId].maxMintsPerWallet) revert MintLimitExceeded();
        
        if (_poolId <= 3 && !whitelist[_poolId][msg.sender]) revert NotWhitelisted();

        PoolInfo storage pool = pools[_poolId];
        if (pool.totalMinted >= pool.maxSupply) revert PoolFull();
        if (msg.value < pool.mintPrice) revert InsufficientPayment();

        uint256 mintAmount = 1 * (10 ** decimals());
        
        if (pool.maxSupply - pool.totalMinted < mintAmount) revert PoolFull();

        // Update state
        pool.totalMinted += mintAmount;
        mintCountPerPool[_poolId][msg.sender] += 1;
        
        // Update global tracking for first mint
        if (!hasMintedGlobal[msg.sender]) {
            hasMintedGlobal[msg.sender] = true;
            mintedOnChain[msg.sender] = _getCurrentChainEid();
        }

        // Refund surplus ETH before minting
        uint256 refundAmount = 0;
        if (msg.value > pool.mintPrice) {
            refundAmount = msg.value - pool.mintPrice;
        }
        
        _mint(msg.sender, mintAmount);
        
        // Send refund if needed
        if (refundAmount > 0) {
            (bool success, ) = msg.sender.call{value: refundAmount}("");
            if (!success) revert TransferFailed();
        }

        emit PoolMinted(msg.sender, _poolId, mintAmount, block.timestamp);
        
        // Notify other chains about this mint
        _notifyOtherChains(msg.sender, _poolId);
    }

    // ========== HELPER FUNCTIONS ==========
    function _getCurrentChainEid() internal view returns (uint32) {
        uint256 chainId = block.chainid;
        if (chainId == 10) return 30111; // Optimism
        if (chainId == 59144) return 30183; // Linea
        return 0; // Unknown chain
    }

    // ========== CROSS-CHAIN TRANSFER (SOULBOUND) ==========
    function transferToChain(uint32 _dstEid, uint256 _amount) external payable {
        if (!crossChainEnabled) revert PoolDisabled();
        // if (_to == address(0)) revert InvalidAddress();
        if (_amount == 0) revert InvalidAmount();
        if (balanceOf(msg.sender) < _amount) revert InsufficientPayment();

        _burn(msg.sender, _amount);

        ActionData memory action = ActionData({
            actionType: ActionType.MintTokensForBurn,
            account: msg.sender, // Always transfer to the same wallet
            amount: _amount,
            poolId: 0 // Not used for transfers
        });

        bytes memory message = abi.encode(action);
        uint128 gasLimit = crossChainGasLimits[_dstEid] > 0 ? crossChainGasLimits[_dstEid] : defaultGasLimit;
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(gasLimit, 0);
        
        MessagingFee memory fee = _quote(_dstEid, message, options, false);
        if (msg.value < fee.nativeFee) revert InsufficientPayment();

        _lzSend(_dstEid, message, options, MessagingFee(fee.nativeFee, 0), payable(msg.sender));
        
        emit CrossChainTransfer(msg.sender, msg.sender, _amount, _dstEid);
    }

    // ========== ADMIN FUNCTIONS ==========
    function enablePool(uint8 _poolId) external onlyOwner {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        pools[_poolId].enabled = true;
        emit PoolStatusChanged(_poolId, true);
    }

    function disablePool(uint8 _poolId) external onlyOwner {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        pools[_poolId].enabled = false;
        emit PoolStatusChanged(_poolId, false);
    }

    function enableAllPools() external onlyOwner {
        for (uint8 i = 1; i <= MAX_POOLS; i++) {
            pools[i].enabled = true;
        }
        emit AllPoolsStatusChanged(true);
    }

    function disableAllPools() external onlyOwner {
        for (uint8 i = 1; i <= MAX_POOLS; i++) {
            pools[i].enabled = false;
        }
        emit AllPoolsStatusChanged(false);
    }

    function setPoolPrice(uint8 _poolId, uint256 _newPrice) external onlyOwner {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        pools[_poolId].mintPrice = _newPrice;
    }

    function setPoolMintLimit(uint8 _poolId, uint256 _maxMints) external onlyOwner {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        pools[_poolId].maxMintsPerWallet = _maxMints;
    }

    function setMintingEnabled(bool _enabled) external onlyOwner {
        mintingEnabled = _enabled;
    }

    function setCrossChainEnabled(bool _enabled) external onlyOwner {
        crossChainEnabled = _enabled;
    }

    function setGasLimit(uint32 _dstEid, uint128 _gasLimit) external onlyOwner {
        crossChainGasLimits[_dstEid] = _gasLimit;
    }

    // setPeer function is inherited from OAppCore

    function resetUserMint(address _user) external onlyOwner {
        hasMintedGlobal[_user] = false;
        mintedOnChain[_user] = 0;
        for (uint8 i = 1; i <= MAX_POOLS; i++) {
            mintCountPerPool[i][_user] = 0;
        }
    }

    // NEW: Reset user mint for specific pool
    function resetUserMintForPool(address _user, uint8 _poolId) external onlyOwner {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        mintCountPerPool[_poolId][_user] = 0;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner().call{value: balance}("");
            if (!success) revert TransferFailed();
        }
    }

    // ========== VIEW FUNCTIONS ==========
    function getPoolInfo(uint8 _poolId) external view returns (PoolInfo memory) {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        return pools[_poolId];
    }

    function getAvailablePools() external view returns (uint8[] memory) {
        uint8[] memory availablePools = new uint8[](MAX_POOLS);
        uint8 count = 0;
        for (uint8 i = 1; i <= MAX_POOLS; i++) {
            if (pools[i].enabled) {
                availablePools[count] = i;
                count++;
            }
        }
        // Resize array
        uint8[] memory result = new uint8[](count);
        for (uint8 i = 0; i < count; i++) {
            result[i] = availablePools[i];
        }
        return result;
    }

    function getUserMintInfo(address _user) external view returns (bool hasGlobalMint, uint32 chainMintedOn) {
        return (hasMintedGlobal[_user], mintedOnChain[_user]);
    }

    // NEW: Get user's mint count for a specific pool
    function getUserMintCount(address _user, uint8 _poolId) external view returns (uint256) {
        if (_poolId < 1 || _poolId > MAX_POOLS) revert InvalidPoolId();
        return mintCountPerPool[_poolId][_user];
    }

    // ========== RECEIVE FUNCTION ==========
    receive() external payable {
        if (msg.value > 0 && mintingEnabled) {
            // Try to mint from pool 1 if conditions are met
            if (pools[1].enabled && mintCountPerPool[1][msg.sender] < pools[1].maxMintsPerWallet && 
                msg.value >= pools[1].mintPrice && pools[1].totalMinted < pools[1].maxSupply) {
                
                if (pools[1].totalMinted + (1 * (10 ** decimals())) <= pools[1].maxSupply) {
                    // Only proceed if whitelisted (for pools 1-3)
                    if (whitelist[1][msg.sender]) {
                        pools[1].totalMinted += (1 * (10 ** decimals()));
                        mintCountPerPool[1][msg.sender] += 1;
                        
                        if (!hasMintedGlobal[msg.sender]) {
                            hasMintedGlobal[msg.sender] = true;
                            mintedOnChain[msg.sender] = _getCurrentChainEid();
                        }
                        
                        _mint(msg.sender, 1 * (10 ** decimals()));
                        
                        // Refund excess
                        if (msg.value > pools[1].mintPrice) {
                            uint256 refund = msg.value - pools[1].mintPrice;
                            (bool success, ) = msg.sender.call{value: refund}("");
                            require(success, "Refund failed");
                        }
                        
                        emit PoolMinted(msg.sender, 1, 1 * (10 ** decimals()), block.timestamp);
                        
                        // Notify other chains
                        _notifyOtherChains(msg.sender, 1);
                    }
                }
            }
        }
    }
}