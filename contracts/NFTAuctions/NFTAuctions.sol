//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./libraries/abdk/ABDKMathQuad.sol";
import "./INFTCollectionManager.sol";

/// @title NFT Marketplace's Auction support
/// @author Flavio Brassesco
/// @notice Adds support for running Auctions in NFT Marketplace
/// @dev Users are required to send msg.value when creating a bid. Only max bid gets stored.
/// Users can't cancel bids, bids can only get cancelled once another higher bid is created.
/// Users can't cancel an auction and higher bid always gets the NFT.
/// Users must retrieve their money manually by calling retrievePendingFunds()
contract NFTAuctions is ReentrancyGuard, Ownable, ERC721Holder, ERC2771Context {
  using Counters for Counters.Counter;
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;

  struct AuctionItem {
    address seller;
    address currentBidder;
    uint256 currentBid;
    uint256 endsAt;
  }

  mapping(address => mapping(uint256 => AuctionItem)) internal _auctionItems;
  mapping(address => mapping(address => EnumerableSet.UintSet))
    internal _userTokenIds;
  mapping(address => EnumerableSet.UintSet) internal _collectionTokenIds;

  uint256 internal _pendingFunds;
  uint256 internal MAX_DAYS;
  bool internal _panicSwitch = false;
  address _collectionManager;

  event AuctionItemCreated(
    address indexed seller,
    address indexed nftContract,
    uint256 indexed tokenId,
    uint256 price,
    uint256 endsAt
  );

  event AuctionItemTransfer(
    address from,
    address indexed to,
    address indexed nftContract,
    uint256 indexed tokenId,
    uint256 price,
    bool sold
  );

  event AuctionBidCreated(
    address indexed currentBidder,
    address indexed nftContract,
    uint256 indexed tokenId,
    uint256 currentBid,
    uint256 endsAt
  );

  constructor(
    uint256 maxDays_,
    address collectionManager_,
    address trustedForwarder_
  ) ERC2771Context(trustedForwarder_) {
    _pendingFunds = 0;
    MAX_DAYS = maxDays_;
    _collectionManager = collectionManager_;
  }

  /// @notice Starts an Auction for a given NFT
  /// @param floorPrice_ Floor price in wei
  /// @param days_ Duration in days. 1 to MAX_DAYS inclusive
  function createMarketAuction(
    address contractAddress_,
    uint256 tokenId_,
    uint256 floorPrice_,
    uint256 days_
  ) public nonReentrant {
    onlyNotPanic();
    require(floorPrice_ > 0, "Floor price must be at least 1 wei");
    require(days_ >= 1 && days_ <= MAX_DAYS, "Duration out of bounds");

    _addAuctionItem(
      _msgSender(),
      contractAddress_,
      tokenId_,
      floorPrice_,
      days_
    );

    emit AuctionItemCreated(
      _msgSender(),
      contractAddress_,
      tokenId_,
      floorPrice_,
      block.timestamp + (days_ * 24 * 60 * 60)
    );
    //NFT transfer from msg sender to this contract
    IERC721(contractAddress_).safeTransferFrom(
      _msgSender(),
      address(this),
      tokenId_
    );
  }

  /// @notice Start an auction and create a bid for a whitelisted NFT belonging to owner()
  /// @dev This allows the marketplace owner to list a batch of NFTs as sellable by Auction.
  /// Should be clarified to users that when placing a bid the auction will start with MAX_DAYS of duration.
  function createMarketOwnerAuction(
    address bidder_,
    address contractAddress_,
    uint256 tokenId_
  ) public payable onlyOwner nonReentrant {
    onlyNotPanic();
    onlyWhitelisted(contractAddress_);
    uint256 floorPrice = INFTCollectionManager(_collectionManager)
      .getFloorPrice(contractAddress_);
    require(floorPrice > 0, "Floor price must be greater than 0");
    require(
      msg.value >= floorPrice,
      "Value sent must be greater than floor price"
    );

    _addAuctionItem(
      _msgSender(),
      contractAddress_,
      tokenId_,
      floorPrice,
      MAX_DAYS
    );

    emit AuctionItemCreated(
      _msgSender(),
      contractAddress_,
      tokenId_,
      floorPrice,
      block.timestamp + (MAX_DAYS * 24 * 60 * 60)
    );

    _addAuctionBid(contractAddress_, tokenId_, bidder_, msg.value);

    IERC721(contractAddress_).safeTransferFrom(
      _msgSender(),
      address(this),
      tokenId_
    );
  }

  /// @notice Creates a bid for a given NFT
  /// @dev Only highest bid is saved for a given NFT Auction.
  function createAuctionBid(address contractAddress_, uint256 tokenId_)
    public
    payable
    nonReentrant
  {
    onlyNotPanic();
    onlyNotSeller(contractAddress_, tokenId_);
    onlyNotCurrentBidder(contractAddress_, tokenId_);
    onlyAuctionInProgress(contractAddress_, tokenId_);

    if (_auctionItems[contractAddress_][tokenId_].currentBidder == address(0)) {
      require(
        msg.value >= _auctionItems[contractAddress_][tokenId_].currentBid,
        "Your bid must be equal or higher than floor price"
      );
    } else {
      require(
        msg.value > _auctionItems[contractAddress_][tokenId_].currentBid,
        "Your bid must be higher than last bid"
      );
    }
    _addAuctionBid(contractAddress_, tokenId_, _msgSender(), msg.value);
  }

  /// @notice Finish an auction and receive payment
  function finishAuctionSale(address contractAddress_, uint256 tokenId_)
    public
    nonReentrant
  {
    onlyAfterEnd(contractAddress_, tokenId_);
    if (
      _auctionItems[contractAddress_][tokenId_].seller == _msgSender() ||
      _auctionItems[contractAddress_][tokenId_].currentBidder == _msgSender()
    ) {
      _finishAuctionSale(contractAddress_, tokenId_);
    } else {
      revert("Only Auction participants can finish an auction");
    }
  }

  /// @notice Retrieve payed secondary sales fees.
  function transferSalesFees() public onlyOwner nonReentrant {
    uint256 salesFees = address(this).balance - _pendingFunds;
    require(salesFees > 0, "No sales fees to retrieve");
    Address.sendValue(payable(owner()), salesFees);
  }

  function itemOfUserByIndex(
    address user_,
    address contractAddress_,
    uint256 index_
  ) public view returns (AuctionItem memory) {
    require(
      index_ < _userTokenIds[user_][contractAddress_].length(),
      "Index out of bounds"
    );
    uint256 tokenId = _userTokenIds[user_][contractAddress_].at(index_);
    return _auctionItems[contractAddress_][tokenId];
  }

  /// @notice Returns amount of items listed by the seller
  function getUserItemsCount(address user_, address contractAddress_)
    public
    view
    returns (uint256)
  {
    return _userTokenIds[user_][contractAddress_].length();
  }

  function itemByIndex(address contractAddress_, uint256 index_)
    public
    view
    returns (AuctionItem memory)
  {
    require(
      index_ < _collectionTokenIds[contractAddress_].length(),
      "Index out of bounds"
    );
    uint256 tokenId = _collectionTokenIds[contractAddress_].at(index_);
    return _auctionItems[contractAddress_][tokenId];
  }

  /// @notice Returns total amount of items listed in the marketplace
  function getAllItemsCount(address contractAddress_)
    public
    view
    returns (uint256)
  {
    return _collectionTokenIds[contractAddress_].length();
  }

  function setPanicSwitch(bool status_) public onlyOwner {
    _panicSwitch = status_;
  }

  function _addAuctionItem(
    address user_,
    address contractAddress_,
    uint256 tokenId_,
    uint256 floorPrice_,
    uint256 days_
  ) internal {
    _userTokenIds[user_][contractAddress_].add(tokenId_);
    _collectionTokenIds[contractAddress_].add(tokenId_);
    _auctionItems[contractAddress_][tokenId_] = AuctionItem(
      user_,
      address(0),
      floorPrice_,
      block.timestamp + (days_ * 24 * 60 * 60)
    );
  }

  function _destroyAuctionItem(
    address sender_,
    address contractAddress_,
    uint256 tokenId_
  ) internal {
    _userTokenIds[sender_][contractAddress_].remove(tokenId_);
    _collectionTokenIds[contractAddress_].remove(tokenId_);
    delete _auctionItems[contractAddress_][tokenId_];
  }

  function _addAuctionBid(
    address contractAddress_,
    uint256 tokenId_,
    address bidder_,
    uint256 bid_
  ) internal {
    // saving information to make external call after state change
    address previousBidder = _auctionItems[contractAddress_][tokenId_]
      .currentBidder;
    uint256 previousBid = _auctionItems[contractAddress_][tokenId_].currentBid;

    //update general pending funds with this new bid
    _pendingFunds += bid_;

    _auctionItems[contractAddress_][tokenId_].currentBid = bid_;
    _auctionItems[contractAddress_][tokenId_].currentBidder = bidder_;
    //if remaining days for auction to end are < 1, then reset endsAt to now + 1 day;
    uint256 remainingSeconds = (_auctionItems[contractAddress_][tokenId_]
      .endsAt - block.timestamp);
    if (remainingSeconds < 86400) {
      _auctionItems[contractAddress_][tokenId_].endsAt =
        block.timestamp +
        1 days;
    }

    emit AuctionBidCreated(
      _auctionItems[contractAddress_][tokenId_].currentBidder,
      contractAddress_,
      tokenId_,
      _auctionItems[contractAddress_][tokenId_].currentBid,
      _auctionItems[contractAddress_][tokenId_].endsAt
    );

    //if it is not the first bid
    if (previousBidder != address(0)) {
      _pendingFunds -= previousBid;

      Address.sendValue(payable(previousBidder), previousBid);
    }
  }

  ///@dev Finish an auction and retrieve funds / transfer NFT
  function _finishAuctionSale(address contractAddress_, uint256 tokenId_)
    private
  {
    // saving information to make external calls after state change
    address seller = _auctionItems[contractAddress_][tokenId_].seller;
    address to;
    bool sold;
    uint256 currentBid;

    //if there is an offer after auction ended
    if (_auctionItems[contractAddress_][tokenId_].currentBidder != address(0)) {
      currentBid = _auctionItems[contractAddress_][tokenId_].currentBid;
      to = _auctionItems[contractAddress_][tokenId_].currentBidder;
      sold = true;
    } else {
      //is not sold so we return the NFT.
      to = seller;
      sold = false;
    }

    emit AuctionItemTransfer(
      seller,
      to,
      contractAddress_,
      tokenId_,
      _auctionItems[contractAddress_][tokenId_].currentBid,
      sold
    );

    _destroyAuctionItem(seller, contractAddress_, tokenId_);

    IERC721(contractAddress_).safeTransferFrom(address(this), to, tokenId_);

    if (sold) {
      _pendingFunds -= currentBid;

      // Payment & fee calculation
      uint256 paymentToSeller = currentBid -
        _calculateFee(currentBid, contractAddress_);

      Address.sendValue(payable(seller), paymentToSeller);
    }
  }

  function _calculateFee(uint256 amount_, address contractAddress_)
    internal
    view
    returns (uint256)
  {
    uint256 fee = ABDKMathQuad.toUInt(
      ABDKMathQuad.div(
        ABDKMathQuad.mul(
          ABDKMathQuad.fromUInt(
            INFTCollectionManager(_collectionManager).getFee(contractAddress_)
          ),
          ABDKMathQuad.fromUInt(amount_)
        ),
        ABDKMathQuad.fromUInt(100)
      )
    );
    return fee;
  }

  function _msgSender()
    internal
    view
    virtual
    override(Context, ERC2771Context)
    returns (address sender)
  {
    return ERC2771Context._msgSender();
  }

  function _msgData()
    internal
    view
    virtual
    override(Context, ERC2771Context)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }

  function onlyNotCurrentBidder(address contractAddress_, uint256 tokenId_)
    internal
    view
  {
    require(
      _msgSender() != _auctionItems[contractAddress_][tokenId_].currentBidder,
      "Current bidder can't perform this action"
    );
  }

  function onlyAuctionInProgress(address contractAddress_, uint256 tokenId_)
    internal
    view
  {
    require(
      _auctionItems[contractAddress_][tokenId_].endsAt > 0 &&
        block.timestamp < _auctionItems[contractAddress_][tokenId_].endsAt,
      "Auction has not started or it's already finished"
    );
  }

  function onlyAfterEnd(address contractAddress_, uint256 tokenId_)
    internal
    view
  {
    require(_auctionItems[contractAddress_][tokenId_].endsAt > 0);
    require(
      block.timestamp > _auctionItems[contractAddress_][tokenId_].endsAt,
      "Auction must be finished to perform this action"
    );
  }

  function onlyNotPanic() internal view {
    require(!_panicSwitch, "Something went wrong");
  }

  function onlyNotSeller(address contractAddress_, uint256 tokenId_)
    internal
    view
  {
    require(
      _auctionItems[contractAddress_][tokenId_].seller != _msgSender(),
      "Seller is not authorized"
    );
  }

  function onlyWhitelisted(address contractAddress_) internal view {
    require(
      INFTCollectionManager(_collectionManager).isWhitelistedCollection(
        contractAddress_
      ),
      "Contract is not whitelisted"
    );
  }
}
