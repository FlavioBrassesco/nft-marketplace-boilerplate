//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title A simple NFT marketplace for collection owners.
/// @author Flavio Brassesco
/// @notice Users can use this marketplace to sell NFTs that are part of collections developed by the marketplace owner.
/// @dev This should be paired with a webapp that has some kind of cache implemented.
/// There are a few functions implemented that are useful to keep cache and on-chain data in sync.
contract NFTMarketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter internal _itemIDs;
    Counters.Counter internal _activeItemsCount;

    /// Deactivates core functionality if things go wrong.
    bool internal panicSwitch;

    /// Mapping for item storage.
    /// Unique NFT ID = uint256(0) | address | tokenId<<160
    mapping(uint256 => MarketItem) internal _nftIDToMarketItem;

    /// Mapping for item iteration
    mapping(uint256 => uint256) internal _itemIDToNftID;

    mapping(address => Counters.Counter) internal _sellerToListedItemsCount;

    enum Status {
        NONE,
        FORSALE,
        AUCTION
    }

    /// Cut 44% of cost by packing some variables.
    /// packedData = uint256(0) | contractAddress<<0 | tokenId<<160 | itemId<<192 | status<<224
    /// Both tokenId and itemId values are expected to not exceed 32bits.
    struct MarketItem {
        uint256 packedData;
        uint256 price;
        address payable seller;
    }

    // Contract Address Management
    mapping(address => bool) internal _isWhitelistedNFTContract;
    mapping(address => uint256) internal _NFTContractToFee;
    mapping(address => uint256) internal _NFTContractToFloorPrice;

    /// Useful to block some items from listing
    mapping(uint256 => bool) internal _nftIDToMarketItemBlacklist;

    /// @notice Logs when a NFT is listed for sale.
    event MarketItemCreated(
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price,
        address indexed nftContract,
        address indexed seller
    );

    /// @notice Logs when a listed NFT is no longer for sale.
    event MarketItemCancelled(
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price,
        address indexed nftContract,
        address indexed seller
    );

    /// @notice Logs when a listed NFT is sold.
    event MarketItemSold(
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price,
        address indexed nftContract,
        address indexed seller,
        address owner
    );

    // The content of the following modifiers is pretty self explanatory.

    modifier onlyNotPanic() {
        require(!panicSwitch, "Something went really wrong.");
        _;
    }

    modifier onlyNotListed(address _NFTContract, uint32 _tokenId) {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            unpackMarketItemStatus(_nftIDToMarketItem[nftID].packedData) ==
                Status.NONE,
            "Item not allowed"
        );
        _;
    }

    modifier onlyNotOwner() {
        require(msg.sender != owner(), "Owner not allowed");
        _;
    }

    modifier onlyNotSeller(address _NFTContract, uint32 _tokenId) {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            msg.sender != _nftIDToMarketItem[nftID].seller,
            "Seller not allowed"
        );
        _;
    }

    modifier onlySeller(address _NFTContract, uint32 _tokenId) {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            payable(msg.sender) == _nftIDToMarketItem[nftID].seller,
            "Only seller allowed"
        );
        _;
    }

    modifier onlyNotForSale(address _NFTContract, uint32 _tokenId) {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            unpackMarketItemStatus(_nftIDToMarketItem[nftID].packedData) !=
                Status.FORSALE,
            "Item can't be for sale"
        );
        _;
    }

    modifier onlyForSale(address _NFTContract, uint32 _tokenId) {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            unpackMarketItemStatus(_nftIDToMarketItem[nftID].packedData) ==
                Status.FORSALE,
            "Item is not for sale"
        );
        _;
    }

    modifier onlyWhitelistedContract(address _NFTContract) {
        require(
            _isWhitelistedNFTContract[_NFTContract],
            "Contract not allowed"
        );
        _;
    }

    modifier onlyNotBlockedItem(address _NFTContract, uint32 _tokenId) {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(!_nftIDToMarketItemBlacklist[nftID], "Item is blacklisted");
        _;
    }

    function getSellerItemsCount() public view returns (uint256) {
        return _sellerToListedItemsCount[payable(msg.sender)].current();
    }

    function getActiveItemsCount() public view returns (uint256) {
        return _activeItemsCount.current();
    }

    /// @notice Returns a unique ID for an NFT.
    /// @dev A cheap, gas efficient function to create a unique NFT ID joining address and token ID with a bitwise operation.
    /// this assumes that _tokenId is implemented as a number.
    /// If the marketplace is going to sell only one collection, this becomes useless and code should be refactored.
    /// @param _NFTContract The address of the contract
    /// @param _tokenId The ID of the token
    /// @return uint256 unique NFT ID.
    function makeNftID(address _NFTContract, uint32 _tokenId)
        public
        pure
        returns (uint256)
    {
        return uint256(0) | uint160(_NFTContract) | (uint256(_tokenId) << 160);
    }

    /// @dev Helper function to unpack contractAddress from MarketItem.packedData
    function unpackMarketItemContract(uint256 packedData)
        internal
        pure
        returns (address)
    {
        return address(uint160(packedData));
    }

    /// @dev Helper function to unpack tokenId from MarketItem.packedData
    function unpackMarketItemTokenId(uint256 packedData)
        internal
        pure
        returns (uint32)
    {
        return uint32(packedData >> 160);
    }

    /// @dev Helper function to unpack itemId from MarketItem.packedData
    function unpackMarketItemItemId(uint256 packedData)
        internal
        pure
        returns (uint32)
    {
        return uint32(packedData >> 192);
    }

    /// @dev Helper function to unpack status from MarketItem.packedData
    function unpackMarketItemStatus(uint256 packedData)
        internal
        pure
        returns (Status)
    {
        return Status(uint8(packedData >> 224));
    }

    /// @notice Adds a NFT Contract address to the marketplace allowed contracts
    /// @dev onlyOwner function to add a NFT Collection to the whitelist
    /// @param _contractAddress address of NFT Collection
    function addWhitelistedNFTContract(address _contractAddress)
        public
        onlyOwner
    {
        require(_contractAddress != address(0), "Can't add address(0)");
        _isWhitelistedNFTContract[_contractAddress] = true;
    }

    /// @notice Removes a NFT Contract address from the marketplace allowed contracts
    /// @dev onlyOwner function to remove a NFT Collection from the whitelist.
    /// This function doesn't remove already listed items of such NFT Contract address,
    /// only forbids them from further listing.
    /// @param _contractAddress address of NFT Collection
    function removeWhitelistedNFTContract(address _contractAddress)
        public
        virtual
        onlyOwner
    {
        require(_contractAddress != address(0), "Can't remove address(0)");
        delete _isWhitelistedNFTContract[_contractAddress];
    }

    /// @notice Set a secondary sales fee for a NFT collection. ie.: 1000 = 10.00%
    /// @dev onlyOwner function to set fee for all items in a NFT collection.
    /// @param _NFTContract address of NFT collection.
    /// @param _fee secondary sales fee for _NFTContract.
    function setFee(address _NFTContract, uint256 _fee) public onlyOwner {
        require(_NFTContract != address(0), "Can't set fee for address(0)");

        // Edit this line to change the maximum fee.
        require(_fee < 5001, "Can't set fee higher than 50.00%");
        _NFTContractToFee[_NFTContract] = _fee;
    }

    /// @notice Returns the secondary sales fee for the specified NFT collection.
    /// @param _NFTContract address of NFT collection
    /// @return uint256 secondary sales fee. ie.: 1000 = 10.00%
    function getFee(address _NFTContract) public view returns (uint256) {
        require(_NFTContract != address(0), "Can't get fee for address(0)");
        return _NFTContractToFee[_NFTContract];
    }

    /// @notice Set floor price in wei for a NFT collection.
    /// @dev onlyOwner function. This floor price is only used when an item is listed in the webapp by the marketplace owner.
    /// @param _NFTContract address of NFT collection
    /// @param _floorPrice floor price for _NFTContract in wei
    function setFloorPrice(address _NFTContract, uint256 _floorPrice)
        public
        onlyOwner
    {
        require(
            _NFTContract != address(0),
            "Can't set floor price for address(0)"
        );
        require(_floorPrice > 0, "Floor price must be at least 1 wei");
        _NFTContractToFloorPrice[_NFTContract] = _floorPrice;
    }

    /// @notice Returns the floor price for the specified NFT collection
    /// @param _NFTContract address of NFT collection
    /// @return uint256 floor price for _NFTContract in wei
    function getFloorPrice(address _NFTContract) public view returns (uint256) {
        require(
            _NFTContract != address(0),
            "Can't get floor price for address(0)"
        );
        return _NFTContractToFloorPrice[_NFTContract];
    }

    /// @notice Blocks the specified NFT from listing in the marketplace.
    /// @dev onlyOwner function to add a contract and token ID pairing to the marketplace blacklist.
    /// When the marketplace owner adds a NFT contract to the marketplace whitelist,
    /// it allows already minted NFTs (belonging to the owner) to be buyed through the function createMarketOwnerSale,
    /// even if they are not listed in the front-end (ie.: a bot buying directly from this contract).
    /// More on this on createMarketOwnerSale.
    /// This function should be used to preserve some of those NFTs from selling.
    /// Given that this blocks only one item per call, it is not a gas efficient way to block multiple NFTs.
    /// Some options could be implemented such as a packed range block, or a packed array block at the cost
    /// of a more expensive modifier onlyNotBlockedItem
    /// @param _NFTContract address of NFT collection
    /// @param _tokenId  token ID to be blocked
    function addBlockedMarketItem(address _NFTContract, uint32 _tokenId)
        public
        onlyOwner
        onlyWhitelistedContract(_NFTContract)
        onlyNotListed(_NFTContract, _tokenId)
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        _nftIDToMarketItemBlacklist[nftID] = true;
    }

    /// @notice Unblocks the specified NFT from listing in the marketplace.
    function removeBlockedMarketItem(address _NFTContract, uint32 _tokenId)
        public
        onlyOwner
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        delete _nftIDToMarketItemBlacklist[nftID];
    }

    /// @notice List a NFT for sale.
    /// @dev This function is meant to be used by secondary sellers.
    /// Set to payable and require a value if you want to charge a commission for listing.
    /// @param _NFTContract address of the NFT Contract
    /// @param _tokenId ID of the Token
    /// @param _price Price in wei for the item
    function createMarketItem(
        address _NFTContract,
        uint32 _tokenId,
        uint256 _price
    )
        public
        nonReentrant
        onlyWhitelistedContract(_NFTContract)
        onlyNotListed(_NFTContract, _tokenId)
    {
        require(_price > 0, "Price must be at least 1 wei");

        uint256 nftID = makeNftID(_NFTContract, _tokenId);

        _itemIDs.increment();
        uint32 itemId = uint32(_itemIDs.current());

        uint256 packedData = 0;
        packedData |= uint160(_NFTContract);
        packedData |= uint256(_tokenId) << 160;
        packedData |= uint256(itemId) << 192;
        packedData |= uint256(Status.FORSALE) << 224;

        _nftIDToMarketItem[nftID] = MarketItem(
            packedData,
            _price,
            payable(msg.sender)
        );

        //NFT transfer from msg.sender to this contract
        IERC721(_NFTContract).transferFrom(msg.sender, address(this), _tokenId);

        emit MarketItemCreated(
            itemId,
            _tokenId,
            _price,
            _NFTContract,
            payable(msg.sender)
        );

        _activeItemsCount.increment();

        _sellerToListedItemsCount[payable(msg.sender)].increment();
    }

    /// @notice Cancels a listing.
    /// @dev This function is meant to be used by secondary sellers.
    /// @param _NFTContract address of the NFT Contract
    /// @param _tokenId ID of the Token
    function cancelMarketItem(address _NFTContract, uint32 _tokenId)
        public
        nonReentrant
        onlyForSale(_NFTContract, _tokenId)
        onlySeller(_NFTContract, _tokenId)
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);

        uint32 itemId = unpackMarketItemItemId(
            _nftIDToMarketItem[nftID].packedData
        );
        uint32 tokenId = unpackMarketItemTokenId(
            _nftIDToMarketItem[nftID].packedData
        );
        address contractAddress = unpackMarketItemContract(
            _nftIDToMarketItem[nftID].packedData
        );

        IERC721(contractAddress).transferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit MarketItemCancelled(
            itemId,
            tokenId,
            _nftIDToMarketItem[nftID].price,
            contractAddress,
            _nftIDToMarketItem[nftID].seller
        );

        _destroyMarketItem(payable(msg.sender), nftID);
    }

    /// @dev Destroys a created market item.
    /// @param _sender address of the market item seller
    /// @param _nftID NFT unique ID
    function _destroyMarketItem(address _sender, uint256 _nftID) private {
        delete _nftIDToMarketItem[_nftID];
        _activeItemsCount.decrement();
        _sellerToListedItemsCount[_sender].decrement();
    }

    /// @notice Buy a non-listed-in-marketplace item. Only NFTs belonging to the marketplace owner.
    /// @dev public payable function to buy a non-listed-in-marketplace item.
    /// This is useful when the owner of the marketplace wants to sell an entire collection
    /// and save the gas cost (and time) for listing all items.
    /// To avoid users (and specially bots) to buy non-listed-in-marketplace items, a blacklist is implemented to block those items.
    /// Owner of the marketplace must be the owner of the NFT Contract for the item.
    /// @param _NFTContract address of the NFT contract
    /// @param _tokenId ID of the NFT Token
    function createMarketOwnerSale(address _NFTContract, uint32 _tokenId)
        public
        payable
        virtual
        nonReentrant
        onlyWhitelistedContract(_NFTContract)
        onlyNotListed(_NFTContract, _tokenId)
        onlyNotBlockedItem(_NFTContract, _tokenId)
    {
        require(
            _NFTContract != address(0),
            "Contract address can't be address(0)"
        );
        uint256 floorPrice = _NFTContractToFloorPrice[_NFTContract];
        require(floorPrice > 0, "Price must be at least 1 wei");
        require(msg.value == floorPrice, "Asking price must be == floorPrice");

        _itemIDs.increment();

        // NFT transfer
        IERC721(_NFTContract).transferFrom(owner(), msg.sender, _tokenId);

        emit MarketItemSold(
            _itemIDs.current(),
            _tokenId,
            floorPrice,
            _NFTContract,
            owner(),
            payable(msg.sender)
        );

        // This is used instead of transfer or send because of raising gas costs in ethereum blockchain
        // @link https://ethereum.stackexchange.com/questions/78124/is-transfer-still-safe-after-the-istanbul-update
        // for other blockchains the use of transfer or send might be ok.
        (bool success, ) = payable(owner()).call{value: msg.value}("");
        require(success, "Transfer failed.");
    }

    /// @notice Buy a listed in marketplace item.
    /// @param _NFTContract address of the NFT contract
    /// @param _tokenId ID of the NFT Token
    function createMarketSale(address _NFTContract, uint32 _tokenId)
        public
        payable
        nonReentrant
        onlyForSale(_NFTContract, _tokenId)
        onlyNotSeller(_NFTContract, _tokenId)
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        uint256 price = _nftIDToMarketItem[nftID].price;
        uint32 tokenId = unpackMarketItemTokenId(
            _nftIDToMarketItem[nftID].packedData
        );
        uint32 itemId = unpackMarketItemItemId(
            _nftIDToMarketItem[nftID].packedData
        );
        address contractAddress = unpackMarketItemContract(
            _nftIDToMarketItem[nftID].packedData
        );
        address seller = _nftIDToMarketItem[nftID].seller;

        require(msg.value == price, "msg.value is not == Asking price");

        // Payment & fee calculation
        uint256 fee = msg.value * (getFee(contractAddress) / 10000);
        uint256 paymentToSeller = msg.value - fee;

        // NFT transfer
        IERC721(contractAddress).transferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit MarketItemSold(
            itemId,
            tokenId,
            price,
            contractAddress,
            seller,
            payable(msg.sender)
        );

        _destroyMarketItem(seller, nftID);

        // Send payment to seller. Secondary selling fee stays in contract to avoid multiple transfers in one function.
        (bool success, ) = seller.call{value: paymentToSeller}("");
        require(success, "Transfer failed.");
    }

    /// @notice Returns items listed in the marketplace.
    /// @dev This is meant to be used for sync purposes only. Webapp should build a cache for all listed items.
    /// @param _page current page. Beware that for multiple calls this should equal the last returned item's ID + 1
    /// @param _amount amount of items to fetch
    /// @return MarketItem[] array containing _amount items listed in the marketplace
    function fetchItemsForSale(uint256 _page, uint256 _amount)
        public
        view
        returns (MarketItem[] memory)
    {
        MarketItem[] memory items = new MarketItem[](_amount);

        uint256 counter = 0;
        for (uint256 i = _page; i <= _itemIDs.current(); i++) {
            uint256 nftID = _itemIDToNftID[i];
            if (
                unpackMarketItemStatus(_nftIDToMarketItem[nftID].packedData) ==
                Status.FORSALE
            ) {
                MarketItem storage currentItem = _nftIDToMarketItem[nftID];
                items[counter] = currentItem;
                counter++;
                if (counter == _amount) break;
            }
        }
        return items;
    }

    /// @notice Returns all items listed in the marketplace
    /// @dev The function with _page and _amount parameters is safer to use since this could eventually reach the block gas limit
    function fetchItemsForSale() public view returns (MarketItem[] memory) {
        return fetchItemsForSale(0, _activeItemsCount.current());
    }

    /// @notice Retrieve payed secondary sales fees.
    function transferSalesFees() public virtual onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}(
            ""
        );
        require(success, "Transfer failed.");
    }
}
