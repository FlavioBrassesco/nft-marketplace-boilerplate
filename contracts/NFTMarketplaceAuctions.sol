//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFTMarketplace.sol";

/**
@dev adds support for Auctions
 */
contract NFTMarketplaceAuctions is NFTMarketplace {
  using Counters for Counters.Counter;

  struct AuctionItem {
    uint256 itemId;
    uint256 currentBid;
    uint256 endsAt;
    address payable currentBidder;
    bool isAuction;
  }

  event AuctionItemCreated(uint256 indexed itemId, uint256 indexed endsAt);

  event AuctionBidCreated(
    uint256 indexed itemId,
    uint256 indexed currentBid,
    address indexed currentBidder,
    uint256 endsAt
  );

  //map itemId to AuctionItem
  mapping(uint256 => AuctionItem) internal idToAuctionItem;
  //map user address to pending funds for withdraw
  mapping(address => uint256) internal addressToPendingWithdrawal;
  //map nft contract address to bool for auction whitelist. This is only for market-owner sales.
  mapping(address => bool) internal nftContractToAuctionWhitelist;

  uint256 internal _pendingWithdrawals;

  constructor() {
    _pendingWithdrawals = 0;
  }

  modifier onlyCurrentBidder(uint256 _itemId) {
    require(payable(msg.sender) == idToAuctionItem[_itemId].currentBidder);
    _;
  }

  modifier onlyNotCurrentBidder(uint256 _itemId) {
    require(payable(msg.sender) != idToAuctionItem[_itemId].currentBidder);
    _;
  }

  modifier onlyAfterStart(uint256 _itemId) {
    require(idToAuctionItem[_itemId].endsAt > 0);
    _;
  }

  modifier onlyBeforeEnd(uint256 _itemId) {
    require(block.timestamp < idToAuctionItem[_itemId].endsAt);
    _;
  }

  modifier onlyAfterEnd(uint256 _itemId) {
    require(idToAuctionItem[_itemId].endsAt > 0);
    require(block.timestamp > idToAuctionItem[_itemId].endsAt);
    _;
  }

  modifier onlyNotAuction(uint256 _itemId) {
    require(!idToAuctionItem[_itemId].isAuction);
    _;
  }

  modifier onlyAuction(uint256 _itemId) {
    require(idToAuctionItem[_itemId].isAuction);
    _;
  }

  modifier onlySenderWithPendingFunds() {
    //avoid running this function without pending funds.
    require(addressToPendingWithdrawal[payable(msg.sender)] > 0);
    _;
  }

  modifier onlyAuctionWhitelistedContract(address _NFTContract) {
    require(nftContractToAuctionWhitelist[_NFTContract]);
    _;
  }

  modifier onlyNotAuctionWhitelistedContract(address _NFTContract) {
    require(!nftContractToAuctionWhitelist[_NFTContract]);
    _;
  }

  function addContractToAuctionWhitelist(address _NFTContract)
    public
    onlyOwner
    onlyWhitelistedContract(_NFTContract)
  {
    require(_NFTContract != address(0), "Can't add address(0)");
    nftContractToAuctionWhitelist[_NFTContract] = true;
  }

  function removeContractFromAuctionWhitelist(address _NFTContract)
    public
    onlyOwner
  {
    require(_NFTContract != address(0), "Can't remove address(0)");
    delete nftContractToAuctionWhitelist[_NFTContract];
  }

  function removeWhitelistedNFTContract(address _contractAddress)
    public
    override
    onlyOwner
  {
    super.removeWhitelistedNFTContract(_contractAddress);
    delete nftContractToAuctionWhitelist[_contractAddress];
  }

  /**
  @dev public function to run an Auction for an NFT.
   Set to payable and require a value if you want to charge a commission for listing.
   @param _NFTContract address of the NFT Contract for the item
   @param _tokenId Id of the NFT Token
   @param _floorPrice Floor Price in wei for the new item
   @param _days how many days should the auction run
   @return id of the newly created market item
  */
  function createMarketAuction(
    address _NFTContract,
    uint256 _tokenId,
    uint256 _floorPrice,
    uint256 _days
  )
    public
    nonReentrant
    onlyWhitelistedContract(_NFTContract)
    onlyNotListed(_NFTContract, _tokenId)
    returns (uint256)
  {
    require(_floorPrice > 0, "Floor price must be at least 1 wei");
    require(_days > 0);

    _itemIds.increment();
    uint256 itemId = _itemIds.current();

    idToMarketItem[itemId] = MarketItem(
      itemId,
      _tokenId,
      _floorPrice,
      _NFTContract,
      payable(msg.sender),
      payable(address(this)),
      true
    );
    // I can't figure out why the linter keeps giving me error when using days keyword
    uint256 _seconds = _days * 24 * 60 * 60;
    uint256 endsAt = block.timestamp + _seconds;
    idToAuctionItem[itemId] = AuctionItem(
      itemId,
      0,
      endsAt,
      payable(address(0)),
      true
    );

    emit MarketItemCreated(
      itemId,
      _tokenId,
      _floorPrice,
      _NFTContract,
      payable(msg.sender)
    );

    emit AuctionItemCreated(itemId, endsAt);

    //NFT transfer from msg.sender to this contract
    IERC721(_NFTContract).transferFrom(msg.sender, address(this), _tokenId);

    _listedItems.increment();
    ownerToListedItems[payable(msg.sender)].increment();

    return itemId;
  }

  /**
  @dev function override to avoid creating a common sale on a meant to be auctioned item.
   */
  function createMarketOwnerSale(address _NFTContract, uint256 _tokenId)
    public
    payable
    override
    nonReentrant
    onlyNotListed(_NFTContract, _tokenId)
    onlyNotBlockedItem(_NFTContract, _tokenId)
    onlyNotAuctionWhitelistedContract(_NFTContract)
  {
    super.createMarketOwnerSale(_NFTContract, _tokenId);
  }

  /**
  @dev public payable function to start an auction on a non-listed-in-blockchain item. 
  This is useful when the owner of the marketplace wants to allow an entire collection
  to be ran as an auction, saving the gas cost (and especially time) for listing all items.
  To avoid users to buy non listed in marketplace items a blacklist is implemented to block those items.
  Owner of the marketplace must be the owner of NFT Contract of the item.
  **/
  function createMarketOwnerAuction(
    address _NFTContract,
    uint256 _tokenId,
    uint256 _days
  )
    public
    payable
    nonReentrant
    onlyNotListed(_NFTContract, _tokenId)
    onlyNotBlockedItem(_NFTContract, _tokenId)
    onlyAuctionWhitelistedContract(_NFTContract)
    returns (uint256)
  {
    uint256 floorPrice = nftContractToFloorPrice[_NFTContract];
    require(floorPrice > 0);
    require(msg.value >= floorPrice);
    require(_days > 0);

    _itemIds.increment();
    uint256 itemId = _itemIds.current();

    idToMarketItem[itemId] = MarketItem(
      itemId,
      _tokenId,
      floorPrice,
      _NFTContract,
      payable(address(this)),
      payable(address(0)),
      true
    );

    // I can't figure out why the linter keeps giving me error when using days keyword
    uint256 _seconds = _days * 24 * 60 * 60;
    uint256 endsAt = block.timestamp + _seconds;
    idToAuctionItem[itemId] = AuctionItem(
      itemId,
      msg.value,
      endsAt,
      payable(msg.sender),
      true
    );

    emit MarketItemCreated(
      itemId,
      _tokenId,
      floorPrice,
      _NFTContract,
      payable(address(this))
    );

    emit AuctionItemCreated(itemId, endsAt);
    emit AuctionBidCreated(itemId, msg.value, payable(msg.sender), endsAt);

    //NFT transfer from msg.sender to this contract
    IERC721(_NFTContract).transferFrom(owner(), address(this), _tokenId);

    _listedItems.increment();

    return itemId;
  }

  /**
    @dev public payable function to bid for an auction. 
    Front end is responsible from choosing to use this function instead of sumToPreviousBid when necessary
    @param _itemId Id of the AuctionItem
   */
  function createAuctionBid(uint256 _itemId)
    public
    payable
    nonReentrant
    onlyNotSeller(_itemId)
    onlyAfterStart(_itemId)
    onlyBeforeEnd(_itemId)
    onlyNotCurrentBidder(_itemId)
  {
    require(
      msg.value > idToMarketItem[_itemId].price &&
        msg.value > idToAuctionItem[_itemId].currentBid,
      "Your bid must be higher than last bid"
    );
    //if it is not the first bid
    if (idToAuctionItem[_itemId].currentBidder != address(0)) {
      address payable previousBidder = idToAuctionItem[_itemId].currentBidder;
      uint256 previousBid = idToAuctionItem[_itemId].currentBid;
      //update pending funds for previousBidder
      addressToPendingWithdrawal[previousBidder] += previousBid;
    }

    //update general pending funds with this new bid
    _pendingWithdrawals += msg.value;

    idToAuctionItem[_itemId].currentBid = msg.value;
    idToAuctionItem[_itemId].currentBidder = payable(msg.sender);
    //if remaining days for auction to end are < 1, then reset endsAt to now + 1 day;
    uint256 remainingSeconds = (idToAuctionItem[_itemId].endsAt -
      block.timestamp);
    if (remainingSeconds < 86400) {
      idToAuctionItem[_itemId].endsAt = block.timestamp + 1 days;
    }

    emit AuctionBidCreated(
      _itemId,
      idToAuctionItem[_itemId].currentBid,
      idToAuctionItem[_itemId].currentBidder,
      idToAuctionItem[_itemId].endsAt
    );
  }

  /**
  @dev public payable function to add to a previous bid. 
  Front end is responsible from choosing to use this function instead of createAuctionBid when necessary
  @param _itemId Id of the AuctionItem
  @param _askingPrice new bid. It is asked since pending funds will be used along msg.value
  */
  function sumToPreviousBid(uint256 _itemId, uint256 _askingPrice)
    public
    payable
    nonReentrant
    onlyNotSeller(_itemId)
    onlyAfterStart(_itemId)
    onlyBeforeEnd(_itemId)
    onlyNotCurrentBidder(_itemId)
    onlySenderWithPendingFunds
  {
    //if what address sends along with his pending funds is enough
    require(
      (addressToPendingWithdrawal[payable(msg.sender)] + msg.value) >=
        _askingPrice
    );
    require(_askingPrice > idToAuctionItem[_itemId].currentBid);
    //Some more security just to be extra cautious
    require(msg.value < _askingPrice);

    //calculate how much from pending funds is part of this new bid
    uint256 substractFromPending = _askingPrice - msg.value;
    //substract that amount from pending funds for user
    addressToPendingWithdrawal[payable(msg.sender)] -= substractFromPending;
    //add msg.value to general pending funds
    _pendingWithdrawals += msg.value;

    address payable previousBidder = idToAuctionItem[_itemId].currentBidder;
    uint256 previousBid = idToAuctionItem[_itemId].currentBid;
    //update pending funds for previousBidder
    addressToPendingWithdrawal[previousBidder] += previousBid;

    idToAuctionItem[_itemId].currentBid = _askingPrice;
    idToAuctionItem[_itemId].currentBidder = payable(msg.sender);
    //if remaining days for auction to end are < 1, then reset endsAt to now + 1 day;
    uint256 remainingSeconds = (idToAuctionItem[_itemId].endsAt -
      block.timestamp);
    if (remainingSeconds < 86400) {
      idToAuctionItem[_itemId].endsAt = block.timestamp + 1 days;
    }

    emit AuctionBidCreated(
      _itemId,
      idToAuctionItem[_itemId].currentBid,
      idToAuctionItem[_itemId].currentBidder,
      idToAuctionItem[_itemId].endsAt
    );
  }

  /**
  @dev public function to allow not winning users to retrieve their funds
   */
  function retrievePendingFunds()
    public
    nonReentrant
    onlyNotOwner
    onlySenderWithPendingFunds
  {
    uint256 pendingFunds = addressToPendingWithdrawal[payable(msg.sender)];
    addressToPendingWithdrawal[payable(msg.sender)] = 0;
    (bool success, ) = payable(msg.sender).call{ value: pendingFunds }("");
    require(success, "Transfer failed.");
  }

  /**
  @dev private function to finish an auction and retrieve funds / transfer NFT
   */
  function _finishAuctionSale(uint256 _itemId)
    private
    onlyAfterEnd(_itemId)
    onlyAuction(_itemId)
  {
    //if there is an offer after auction ended
    if (
      idToAuctionItem[_itemId].currentBidder != address(0) &&
      idToAuctionItem[_itemId].currentBid != 0
    ) {
      address newOwner = idToAuctionItem[_itemId].currentBidder;
      address seller = idToMarketItem[_itemId].seller;
      uint256 payment = idToAuctionItem[_itemId].currentBid;
      //NFT transfer
      IERC721(idToMarketItem[_itemId].nftContract).transferFrom(
        address(this),
        newOwner,
        idToMarketItem[_itemId].tokenId
      );

      emit MarketItemSold(
        _itemId,
        idToMarketItem[_itemId].tokenId,
        idToAuctionItem[_itemId].currentBid,
        idToMarketItem[_itemId].nftContract,
        idToMarketItem[_itemId].seller,
        idToAuctionItem[_itemId].currentBidder
      );

      //remove mapping of nft hash
      bytes32 hash = keccak256(
        abi.encodePacked(
          idToMarketItem[_itemId].nftContract,
          idToMarketItem[_itemId].tokenId
        )
      );
      delete nftHashToItemId[hash];

      delete idToMarketItem[_itemId];
      delete idToAuctionItem[_itemId];

      _itemsSold.increment();
      _listedItems.decrement();
      ownerToListedItems[seller].decrement();

      _pendingWithdrawals -= payment;
      (bool success, ) = seller.call{ value: payment }("");
      require(success, "Transfer failed.");
    } else {
      //is not sold so we return the NFT.

      IERC721(idToMarketItem[_itemId].nftContract).transferFrom(
        address(this),
        idToMarketItem[_itemId].seller,
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
      bytes32 hash = keccak256(
        abi.encodePacked(
          idToMarketItem[_itemId].nftContract,
          idToMarketItem[_itemId].tokenId
        )
      );
      delete nftHashToItemId[hash];

      _listedItems.decrement();
      ownerToListedItems[idToMarketItem[_itemId].seller].decrement();

      delete idToMarketItem[_itemId];
      delete idToAuctionItem[_itemId];
    }
  }

  /**
  @dev public function for sellers to finish an auction and retrieve funds / transfer NFT
   */
  function finishAuctionSale(uint256 _itemId)
    public
    nonReentrant
    onlySeller(_itemId)
  {
    _finishAuctionSale(_itemId);
  }

  /**
  @dev public function for winning buyers to finish an auction and transfer NFT / pay funds
   */
  function retrieveAuctionItem(uint256 _itemId)
    public
    nonReentrant
    onlyCurrentBidder(_itemId)
  {
    _finishAuctionSale(_itemId);
  }

  /**
  @dev this function should replace fetchItemsForSale if a Marketplace with Auction support is used.
  **/
  function fetchItemsInAuction()
    public
    view
    returns (MarketItem[] memory items, AuctionItem[] memory aItems)
  {
    items = fetchItemsForSale();
    aItems = new AuctionItem[](items.length);
    for (uint256 i = 0; i < items.length; i++) {
      if (idToAuctionItem[items[i].itemId].itemId != 0) {
        AuctionItem storage currentItem = idToAuctionItem[items[i].itemId];
        aItems[i] = currentItem;
      }
    }
  }

  /**
  @dev this function should replace fetchMyItemsForSale if Marketplace with Auction support is used
  **/
  function fetchMyItemsInAuction()
    public
    view
    returns (MarketItem[] memory items, AuctionItem[] memory aItems)
  {
    items = fetchMyItemsForSale();
    aItems = new AuctionItem[](items.length);
    for (uint256 i = 0; i < items.length; i++) {
      if (idToAuctionItem[items[i].itemId].itemId != 0) {
        AuctionItem storage currentItem = idToAuctionItem[items[i].itemId];
        aItems[i] = currentItem;
      }
    }
  }

  /**
   * @dev onlyOwner function to retrieve payed secondary sales fees.
   **/
  function getSalesFees() public override onlyOwner {
    uint256 pendingFunds = address(this).balance - _pendingWithdrawals;
    require(pendingFunds > 0, "Not pending funds to retrieve");
    (bool success, ) = payable(owner()).call{ value: pendingFunds }("");
    require(success, "Transfer failed.");
  }
}
