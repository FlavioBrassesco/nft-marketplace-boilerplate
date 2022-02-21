//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMarketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter internal _itemIds;
    Counters.Counter internal _itemsSold;
    Counters.Counter internal _listedItems;

    struct MarketItem {
        uint256 itemId;
        uint256 tokenId;
        uint256 price;
        address nftContract;
        address payable seller;
        address payable owner;
        bool forSale;
    }

    struct NFTPair {
        address nftContract;
        uint256 tokenId;
    }

    event MarketItemCreated(
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price,
        address indexed nftContract,
        address indexed seller
    );

    event MarketItemCancelled(
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price,
        address indexed nftContract,
        address indexed seller
    );

    event MarketItemSold(
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price,
        address indexed nftContract,
        address indexed seller,
        address owner
    );

    //array of whitelisted NFT Collections that can be used in the marketplace
    address[] internal whitelistedNFTContracts;
    //map NFT Contract address to index in whitelistedNFTContracts. To avoid clashing of 0 index values
    //index are stored as whitelistedNFTContracts.length.
    mapping(address => uint256) internal whitelistedNFTContractsToIndex;
    //map itemId to MarketItem
    mapping(uint256 => MarketItem) internal idToMarketItem;
    //map NFT contract address to fee
    mapping(address => uint256) internal nftContractToFee;
    //map NFT contract address to floor price (only used by marketplace owner listed items)
    mapping(address => uint256) internal nftContractToFloorPrice;
    //map user address to listed items quantity
    mapping(address => Counters.Counter) internal ownerToListedItems;

    enum HashStatus {
        NONE,
        MARKET,
        AUCTION
    }
    //map keccak256 of address and tokenId to itemId
    mapping(bytes32 => HashStatus) internal nftHashStatus;

    //map keccak256 of address and tokenId to bool (blacklist)
    mapping(bytes32 => bool) internal nftHashToMarketItemBlacklist;

    mapping(bytes32 => NFTPair) internal nftHashToNFTPair;

    constructor() {
        //here you could set some initial whitelisted NFT Collections, floor prices and fees
        //addWhitelistedNFTContract(address(0x));
        //setFloorPrice(address(0x), 0.001);
        //setFee(address(0x), 1000);
    }

    modifier onlyNotListed(address _NFTContract, uint256 _tokenId) {
        bytes32 hash = makeHash(_NFTContract, _tokenId);
        require(nftHashStatus[hash] == HashStatus.NONE);
        _;
    }

    modifier onlyNotOwner() {
        require(msg.sender != owner());
        _;
    }

    modifier onlyNotSeller(uint256 _itemId) {
        require(msg.sender != idToMarketItem[_itemId].seller);
        _;
    }

    modifier onlySeller(uint256 _itemId) {
        require(payable(msg.sender) == idToMarketItem[_itemId].seller);
        _;
    }

    modifier onlyNotForSale(uint256 _itemId) {
        require(idToMarketItem[_itemId].forSale == false);
        _;
    }

    modifier onlyForSale(uint256 _itemId) {
        require(idToMarketItem[_itemId].forSale == true);
        _;
    }

    //this needs refactoring mapping address to bool and getting rid of array
    modifier onlyWhitelistedContract(address _NFTContract) {
        require(whitelistedNFTContractsToIndex[_NFTContract] != 0);
        _;
    }

    modifier onlyNotBlockedItem(address _NFTContract, uint256 _tokenId) {
        bytes32 hash = makeHash(_NFTContract, _tokenId);
        require(!nftHashToMarketItemBlacklist[hash]);
        _;
    }

    function makeHash(address _NFTContract, uint256 _tokenId)
        public
        pure
        returns (bytes32 hash)
    {
        hash = keccak256(abi.encodePacked(_NFTContract, _tokenId));
    }

    function saveHash(address _NFTContract, uint256 _tokenId)
        public
        returns (bytes32 hash)
    {
        hash = makeHash(_NFTContract, _tokenId);
        if (nftHashToNFTPair[hash].nftContract == address(0)) {
            nftHashToNFTPair[hash] = NFTPair(_NFTContract, _tokenId);
        }
    }

    function getNFTPairFromHash(bytes32 hash)
        public
        view
        returns (NFTPair memory nftPair)
    {
        return nftHashToNFTPair[hash];
    }

    /**
  @dev onlyOwner function to add a NFT Collection to the whitelist
  @param _contractAddress address of NFT Collection
   */
    function addWhitelistedNFTContract(address _contractAddress)
        public
        onlyOwner
    {
        require(_contractAddress != address(0), "Can't add address(0)");
        whitelistedNFTContracts.push(_contractAddress);
        whitelistedNFTContractsToIndex[
            _contractAddress
        ] = whitelistedNFTContracts.length;
    }

    /**
  @dev onlyOwner function to remove a NFT Collection from the whitelist
  @param _contractAddress address of NFT Collection
  * This function only removes NFT Contract address from whitelist. 
  * However, this does not remove already listed items of such NFT Contract address
  * only forbid them from further listing.
  * This is a reason to not execute a delete nftContractToFee[_contractAddress]
   */
    function removeWhitelistedNFTContract(address _contractAddress)
        public
        onlyOwner
    {
        require(_contractAddress != address(0), "Can't remove address(0)");
        //remember: index are stored as whitelistedNFTContracts.length in whitelistedNFTContractsToIndex mapping
        uint256 contractIndex = whitelistedNFTContractsToIndex[
            _contractAddress
        ] - 1;
        address lastContract = whitelistedNFTContracts[
            whitelistedNFTContracts.length - 1
        ];

        //if Last saved contract is not the contract to remove: do the swap.
        if (lastContract != _contractAddress) {
            whitelistedNFTContracts[contractIndex] = lastContract;
            whitelistedNFTContractsToIndex[lastContract] = contractIndex;
        }
        delete whitelistedNFTContractsToIndex[_contractAddress];
        delete whitelistedNFTContracts[whitelistedNFTContracts.length - 1];
    }

    /**
  @return whitelistedNFTContracts array
  */
    function getwhitelistedNFTContracts()
        public
        view
        returns (address[] memory)
    {
        return whitelistedNFTContracts;
    }

    /**
  @dev onlyOwner function to set fee for a determined NFT collection
  @param _NFTContract address of NFT Collection contract
  @param _fee secondary sales fee for _NFTContract. 10000 = 100.00%
   */
    function setFee(address _NFTContract, uint256 _fee) public onlyOwner {
        require(
            _NFTContract != address(0),
            "Error: Can't set fee for address 0"
        );
        //Edit this line to set a maximum fee.
        require(_fee < 5001, "Error: Can't set fee higher than 50.00%");
        nftContractToFee[_NFTContract] = _fee;
    }

    /**
  @return saved fee for _NFTContract
   */
    function getFee(address _NFTContract) public view returns (uint256) {
        require(
            _NFTContract != address(0),
            "Can't retrieve fee from address 0"
        );
        return nftContractToFee[_NFTContract];
    }

    /**
  @dev onlyOwner function to set floor price for a determined NFT collection
  This floor price is only used for marketplace owner collections.
  @param _NFTContract address of NFT Collection contract
  @param _floorPrice floor price for _NFTContract in wei
   */
    function setFloorPrice(address _NFTContract, uint256 _floorPrice)
        public
        onlyOwner
    {
        require(
            _NFTContract != address(0),
            "Error: Can't set floor price for address 0"
        );
        require(_floorPrice > 0, "Error: Floor price must be at least 1 wei");
        nftContractToFloorPrice[_NFTContract] = _floorPrice;
    }

    /**
  @return floor price for _NFTContract
   */
    function getFloorPrice(address _NFTContract) public view returns (uint256) {
        require(
            _NFTContract != address(0),
            "Can't retrieve fee from address 0"
        );
        return nftContractToFloorPrice[_NFTContract];
    }

    function addBlockedMarketItem(address _NFTContract, uint256 _tokenId)
        public
        onlyOwner
        onlyWhitelistedContract(_NFTContract)
        onlyNotListed(_NFTContract, _tokenId)
    {
        bytes32 hash = saveHash(_NFTContract, _tokenId);
        nftHashToMarketItemBlacklist[hash] = true;
    }

    function removeBlockedMarketItem(address _NFTContract, uint256 _tokenId)
        public
        onlyOwner
    {
        bytes32 hash = makeHash(_NFTContract, _tokenId);
        delete nftHashToMarketItemBlacklist[hash];
    }

    /**
   @dev public function to list an NFT for sale. 
   This is meant to be used by secondary sellers, not the owner of the marketplace. 
   Set to payable and require a value if you want to charge a commission for listing.
   @param _NFTContract address of the NFT Contract for the item
   @param _tokenId Id of the NFT Token
   @param _price Price in wei for the new item
   @return id of the newly created market item
   **/
    function createMarketItem(
        address _NFTContract,
        uint256 _tokenId,
        uint256 _price
    )
        public
        nonReentrant
        onlyWhitelistedContract(_NFTContract)
        onlyNotListed(_NFTContract, _tokenId)
        returns (uint256)
    {
        require(_price > 0, "Error: Price must be at least 1 wei");

        _itemIds.increment();
        uint256 itemId = _itemIds.current();

        idToMarketItem[itemId] = MarketItem(
            itemId,
            _tokenId,
            _price,
            _NFTContract,
            payable(msg.sender),
            payable(address(0)),
            true
        );
        //add nft hash to mapping for quick checking if nft is already listed
        bytes32 hash = saveHash(_NFTContract, _tokenId);
        nftHashStatus[hash] = HashStatus.MARKET;

        //NFT transfer from msg.sender to this contract
        IERC721(_NFTContract).transferFrom(msg.sender, address(this), _tokenId);

        emit MarketItemCreated(
            itemId,
            _tokenId,
            _price,
            _NFTContract,
            payable(msg.sender)
        );
        _listedItems.increment();
        ownerToListedItems[payable(msg.sender)].increment();

        return itemId;
    }

    /**
  @dev public function to cancel a listed NFT.
  @param _itemId id of the market item to cancel
   */
    function cancelMarketItem(uint256 _itemId)
        public
        nonReentrant
        onlyForSale(_itemId)
        onlySeller(_itemId)
    {
        IERC721(idToMarketItem[_itemId].nftContract).transferFrom(
            address(this),
            msg.sender,
            idToMarketItem[_itemId].tokenId
        );
        emit MarketItemCancelled(
            _itemId,
            idToMarketItem[_itemId].tokenId,
            idToMarketItem[_itemId].price,
            idToMarketItem[_itemId].nftContract,
            idToMarketItem[_itemId].seller
        );

        //remove mapping of nft hash
        bytes32 hash = makeHash(
            idToMarketItem[_itemId].nftContract,
            idToMarketItem[_itemId].tokenId
        );
        delete nftHashStatus[hash];

        delete idToMarketItem[_itemId];
        _listedItems.decrement();
        ownerToListedItems[payable(msg.sender)].decrement();
    }

    /**
  @dev public payable function to sell a non-listed-in-blockchain item. 
  This is useful when the owner of the marketplace wants to sell an entire collection
  and save the gas cost (and time) for listing all items.
  To avoid users to buy non listed in marketplace items a blacklist is implemented to block those items.
  Owner of the marketplace must be the owner of NFT Contract of the item.
  @param _NFTContract address of the NFT token for sale
  @param _tokenId ID of the NFT Token for sale
  */
    function createMarketOwnerSale(address _NFTContract, uint256 _tokenId)
        public
        payable
        nonReentrant
        onlyWhitelistedContract(_NFTContract)
        onlyNotListed(_NFTContract, _tokenId)
        onlyNotBlockedItem(_NFTContract, _tokenId)
    {
        require(
            _NFTContract != address(0),
            "Contract address can't be address(0)"
        );
        uint256 floorPrice = nftContractToFloorPrice[_NFTContract];
        require(floorPrice > 0, "Price must be at least 1 wei");
        require(
            msg.value == floorPrice,
            "Please submit the asking price in order to complete purchase"
        );

        _itemIds.increment();
        uint256 itemId = _itemIds.current();

        emit MarketItemCreated(
            itemId,
            _tokenId,
            floorPrice,
            _NFTContract,
            owner()
        );

        //NFT transfer
        IERC721(_NFTContract).transferFrom(owner(), msg.sender, _tokenId);

        emit MarketItemSold(
            itemId,
            _tokenId,
            floorPrice,
            _NFTContract,
            owner(),
            payable(msg.sender)
        );

        _itemsSold.increment();

        //this is used instead of transfer or send because of raising gas costs in ethereum blockchain
        //https://ethereum.stackexchange.com/questions/78124/is-transfer-still-safe-after-the-istanbul-update
        //for other blockchains the use of transfer or send might be ok.
        (bool success, ) = payable(owner()).call{value: msg.value}("");
        require(success, "Transfer failed.");
    }

    /**
  @dev public payable function for the selling action.
  @param _itemId ID of the market item being sold
  **/
    function createMarketSale(uint256 _itemId)
        public
        payable
        nonReentrant
        onlyForSale(_itemId)
        onlyNotSeller(_itemId)
    {
        uint256 price = idToMarketItem[_itemId].price;
        uint256 tokenId = idToMarketItem[_itemId].tokenId;
        require(
            msg.value == price,
            "Please submit the asking price in order to complete the purchase"
        );

        address seller = idToMarketItem[_itemId].seller;
        //payment & fee calculation
        uint256 fee = msg.value *
            (getFee(idToMarketItem[_itemId].nftContract) / 10000);
        uint256 paymentToSeller = msg.value - fee;

        //NFT transfer
        IERC721(idToMarketItem[_itemId].nftContract).transferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit MarketItemSold(
            _itemId,
            idToMarketItem[_itemId].tokenId,
            idToMarketItem[_itemId].price,
            idToMarketItem[_itemId].nftContract,
            idToMarketItem[_itemId].seller,
            idToMarketItem[_itemId].owner
        );

        //remove mapping of nft hash
        bytes32 hash = makeHash(
            idToMarketItem[_itemId].nftContract,
            idToMarketItem[_itemId].tokenId
        );
        delete nftHashStatus[hash];

        delete idToMarketItem[_itemId];

        _itemsSold.increment();
        _listedItems.decrement();
        ownerToListedItems[seller].decrement();

        //Send payment to seller. Secondary selling fee stays in contract to avoid multiple transfers in one function.
        (bool success, ) = seller.call{value: paymentToSeller}("");
        require(success, "Transfer failed.");
    }

    /**
  @dev public view function to retrieve all listed items for sale.
  **/
    function fetchItemsForSale() public view returns (MarketItem[] memory) {
        MarketItem[] memory items = new MarketItem[](_listedItems.current());

        uint256 counter = 0;
        for (uint256 i = 1; i <= _itemIds.current(); i++) {
            //price is a good value to check against 0. If it is 0, then is deleted or does not exists.
            if (idToMarketItem[i].price != 0) {
                MarketItem storage currentItem = idToMarketItem[i];
                items[counter] = currentItem;
                counter++;
            }
        }
        return items;
    }

    /**
  @dev public view function to retrieve all msg.sender listed items for sale
  **/
    function fetchMyItemsForSale() public view returns (MarketItem[] memory) {
        uint256 totalItemCount = _itemIds.current();
        uint256 counter = 0;
        MarketItem[] memory items = new MarketItem[](
            ownerToListedItems[payable(msg.sender)].current()
        );
        for (uint256 i = 1; i <= totalItemCount; i++) {
            if (idToMarketItem[i].owner == payable(msg.sender)) {
                uint256 currentId = idToMarketItem[i].itemId;
                MarketItem storage currentItem = idToMarketItem[currentId];
                items[counter] = currentItem;
                counter++;
            }
        }
        return items;
    }

    /**
     * @dev onlyOwner function to retrieve payed secondary sales fees.
     **/
    function getSalesFees() public onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}(
            ""
        );
        require(success, "Transfer failed.");
    }
}
