//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./ContextMixin.sol";
import "./NFTMarketplaceHelpers.sol";
import "./Helpers.sol";
import "./NativeMetaTransactionCalldata.sol";
import "./NFTMarketplaceContractManager.sol";

/// @title A simple NFT marketplace for collection owners.
/// @author Flavio Brassesco
/// @notice Users can use this marketplace to sell NFTs (ERC721) that are part of collections developed by the marketplace owner.
/// @dev This should be paired with a webapp that has some kind of cache implemented.
/// There are a few functions implemented that are useful to keep cache and on-chain data in sync.
contract NFTMarketplace is
    ReentrancyGuard,
    Ownable,
    ERC721Holder,
    ContextMixin,
    NativeMetaTransactionCalldata,
    NFTMarketplaceHelpers
{
    using Counters for Counters.Counter;

    // Deactivates core functionality if things go wrong.
    bool internal _panicSwitch = false;

    // Mapping for item storage.
    // Unique NFT ID = uint256(0) | address | tokenId<<160
    mapping(uint256 => MarketItem) internal _nftIdToMarketItem;

    // mappings for enumeration
    mapping(address => mapping(uint256 => uint256)) internal _userNftIds;
    mapping(address => mapping(uint256 => uint256)) internal _userNftIdsIndex;
    mapping(address => Counters.Counter) internal _userNftIdsCount;
    // mappings for enumeration
    mapping(uint256 => uint256) internal _nftIds;
    mapping(uint256 => uint256) internal _nftIdsIndex;
    Counters.Counter internal _nftIdsCount;

    struct MarketItem {
        address seller;
        uint256 price;
    }

    /// @notice Logs when a NFT is listed for sale.
    event MarketItemCreated(
        address indexed seller,
        address indexed contractAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    /// @notice Logs when a listed NFT is transferred to a user
    event MarketItemTransfer(
        address indexed seller,
        address owner,
        address indexed contractAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    string private _name;
    address private _contractManager;

    constructor(string memory name_, address contractManager_) {
        _name = name_;
        _initializeEIP712(name_);
        _contractManager = contractManager_;
    }

    function name() public view returns (string memory) {
        return _name;
    }

    /// @notice List an ERC721 NFT for sale.
    /// @dev This function is meant to be used by secondary sellers, not NFT collection owner.
    /// Set to payable and require a value if you want to charge a commission for listing.
    /// @param contractAddress_ address of the NFT Contract
    /// @param tokenId_ ID of the Token
    /// @param price_ Price in wei for the item
    function createMarketItem(
        address contractAddress_,
        uint32 tokenId_,
        uint256 price_
    )
        public
        payable
        onlyNotPanic
        nonReentrant
        onlyWhitelistedContract(contractAddress_)
    {
        require(price_ > 0, "Price must be at least 1 wei");

        uint256 nftId = _makeNftId(contractAddress_, tokenId_);

        _addMarketItem(_msgSender(), nftId, price_);

        emit MarketItemCreated(
            _msgSender(),
            contractAddress_,
            tokenId_,
            price_
        );
        //NFT transfer from msg sender to this contract
        IERC721(contractAddress_).safeTransferFrom(
            _msgSender(),
            address(this),
            tokenId_
        );
    }

    /// @notice Cancels a listed item and returns NFT to seller.
    /// @param contractAddress_ address of the NFT Contract
    /// @param tokenId_ ID of the Token
    function cancelMarketItem(address contractAddress_, uint32 tokenId_)
        public
        nonReentrant
        onlyForSale(contractAddress_, tokenId_)
        onlySeller(contractAddress_, tokenId_)
    {
        uint256 nftId = _makeNftId(contractAddress_, tokenId_);

        emit MarketItemTransfer(
            _nftIdToMarketItem[nftId].seller,
            _nftIdToMarketItem[nftId].seller,
            contractAddress_,
            tokenId_,
            _nftIdToMarketItem[nftId].price
        );
        _destroyMarketItem(_msgSender(), nftId);

        IERC721(contractAddress_).safeTransferFrom(
            address(this),
            _msgSender(),
            tokenId_
        );
    }

    /// @notice Buy a listed in marketplace item.
    /// @param contractAddress_ address of the NFT contract
    /// @param tokenId_ ID of the NFT Token
    function createMarketSale(address contractAddress_, uint32 tokenId_)
        public
        payable
        onlyNotPanic
        nonReentrant
        onlyForSale(contractAddress_, tokenId_)
        onlyNotSeller(contractAddress_, tokenId_)
    {
        uint256 nftId = _makeNftId(contractAddress_, tokenId_);

        require(
            msg.value == _nftIdToMarketItem[nftId].price,
            "msg.value is not == Asking price"
        );

        address seller = _nftIdToMarketItem[nftId].seller;

        // Payment & fee calculation
        uint256 paymentToSeller = msg.value -
            Helpers._mulDiv(
                NFTMarketplaceContractManager(_contractManager).getFee(
                    contractAddress_
                ),
                msg.value,
                100
            );

        emit MarketItemTransfer(
            seller,
            _msgSender(),
            contractAddress_,
            tokenId_,
            _nftIdToMarketItem[nftId].price
        );

        // NFT transfer
        IERC721(contractAddress_).safeTransferFrom(
            address(this),
            _msgSender(),
            tokenId_
        );

        _destroyMarketItem(seller, nftId);

        _safeTransferValue(seller, paymentToSeller);
    }

    /// @notice Buy a non-listed-in-marketplace item. Only NFTs belonging to the marketplace owner.
    /// @dev public payable function to buy a non-listed-on-chain marketplace item through a metatransaction
    /// @param contractAddress_ address of the NFT contract
    /// @param tokenId_ ID of the NFT Token
    /// @param to_ address of buyer
    function createMarketOwnerSale(
        address to_,
        address contractAddress_,
        uint32 tokenId_
    )
        public
        payable
        virtual
        onlyNotPanic
        onlyOwner
        nonReentrant
        onlyWhitelistedContract(contractAddress_)
    {
        uint256 floorPrice = NFTMarketplaceContractManager(_contractManager)
            .getFloorPrice(contractAddress_);
        require(floorPrice > 0, "Floor price must be at least 1 wei");
        require(msg.value == floorPrice, "Asking price must be == floorPrice");

        emit MarketItemTransfer(
            _msgSender(),
            to_,
            contractAddress_,
            tokenId_,
            floorPrice
        );

        // NFT transfer
        IERC721(contractAddress_).safeTransferFrom(_msgSender(), to_, tokenId_);

        _safeTransferValue(_msgSender(), msg.value);
    }

    function itemOfUserByIndex(address user_, uint256 _index)
        public
        view
        returns (MarketItem memory)
    {
        require(
            _index < _userNftIdsCount[user_].current(),
            "Index out of bounds"
        );
        uint256 nftId = _userNftIds[user_][_index];
        return _nftIdToMarketItem[nftId];
    }

    /// @notice Returns amount of items listed by the seller
    function getUserItemsCount(address user_) public view returns (uint256) {
        return _userNftIdsCount[user_].current();
    }

    function itemByIndex(uint256 index_)
        public
        view
        returns (MarketItem memory)
    {
        require(index_ < _nftIdsCount.current(), "Index out of bounds");
        uint256 nftId = _nftIds[index_];
        return _nftIdToMarketItem[nftId];
    }

    /// @notice Returns total amount of items listed in the marketplace
    function getAllItemsCount() public view returns (uint256) {
        return _nftIdsCount.current();
    }

    /// @notice set Panic Switch status.
    function setPanicSwitch(bool status_) public onlyOwner {
        _panicSwitch = status_;
    }

    /// @notice Retrieve payed secondary sales fees.
    function transferSalesFees() public virtual onlyOwner {
        _safeTransferValue(owner(), address(this).balance);
    }

    function _addMarketItem(
        address sender_,
        uint256 nftId_,
        uint256 price_
    ) internal {
        _nftIdToMarketItem[nftId_] = MarketItem(sender_, price_);

        _nftIds[_nftIdsCount.current()] = nftId_;
        _nftIdsIndex[nftId_] = _nftIdsCount.current();

        _userNftIds[sender_][_userNftIdsCount[sender_].current()] = nftId_;
        _userNftIdsIndex[sender_][nftId_] = _userNftIdsCount[sender_].current();

        _nftIdsCount.increment();
        _userNftIdsCount[sender_].increment();
    }

    /// @dev Destroys a created market item.
    /// @param sender_ address of the market item seller
    /// @param nftId_ NFT unique ID
    function _destroyMarketItem(address sender_, uint256 nftId_) internal {
        uint256 indexOfNftIds = _nftIdsIndex[nftId_];
        uint256 indexOfUserNftIds = _userNftIdsIndex[sender_][nftId_];

        if (indexOfNftIds != _nftIdsCount.current() - 1) {
            uint256 lastNftId = _nftIds[_nftIdsCount.current() - 1];
            _nftIds[indexOfNftIds] = lastNftId;
        }
        if (indexOfUserNftIds != _userNftIdsCount[sender_].current() - 1) {
            uint256 lastNftId = _userNftIds[sender_][
                _userNftIdsCount[sender_].current() - 1
            ];
            _userNftIds[sender_][indexOfUserNftIds] = lastNftId;
        }
        delete _nftIds[_nftIdsCount.current() - 1];
        delete _userNftIds[sender_][_userNftIdsCount[sender_].current() - 1];
        delete _nftIdToMarketItem[nftId_];
        _nftIdsCount.decrement();
        _userNftIdsCount[sender_].decrement();
    }

    function _msgSender() internal view override returns (address) {
        return ContextMixin.msgSender();
    }

    // The content of the following modifiers is pretty self explanatory.

    modifier onlyNotPanic() {
        require(!_panicSwitch, "Something went wrong");
        _;
    }

    modifier onlyNotSeller(address contractAddress_, uint32 tokenId_) {
        require(
            _msgSender() !=
                _nftIdToMarketItem[_makeNftId(contractAddress_, tokenId_)]
                    .seller,
            "Seller not allowed"
        );
        _;
    }

    modifier onlyForSale(address contractAddress_, uint32 tokenId_) {
        require(
            _nftIdToMarketItem[_makeNftId(contractAddress_, tokenId_)].seller !=
                address(0),
            "Item not for sale"
        );
        _;
    }

    modifier onlySeller(address contractAddress_, uint32 tokenId_) {
        require(
            _msgSender() ==
                _nftIdToMarketItem[_makeNftId(contractAddress_, tokenId_)]
                    .seller,
            "Only seller allowed"
        );
        _;
    }

    modifier onlyWhitelistedContract(address contractAddress_) {
        require(
            NFTMarketplaceContractManager(_contractManager)
                .isWhitelistedNFTContract(contractAddress_),
            "Contract not allowed"
        );
        _;
    }
}
