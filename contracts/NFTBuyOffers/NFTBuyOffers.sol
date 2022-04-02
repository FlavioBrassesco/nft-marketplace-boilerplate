//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./libraries/abdk/ABDKMathQuad.sol";
import "./INFTCollectionManager.sol";

/// @title NFT Marketplace's Buy Offer Support
/// @author Flavio Brassesco
/// @notice Adds support for unsolicited Buy offers in NFT Marketplace
/// @dev Users can post an offer anytime and cancel anytime.
/// Owners can accept an offer anytime (Except if they are running an auction).
/// Offers are stored in a pool and refunded when cancelled.
/// Only bidder is enabled to cancel an offer. Offers don't limit the owner in any case.
/// Buy offers should dissappear from front end in case the owner inits an auction.
/// Is not possible to place a Buy offer for auction items.
contract NFTBuyOffers is
  ReentrancyGuard,
  Ownable,
  ERC721Holder,
  ERC2771Context
{
  using Counters for Counters.Counter;
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;

  mapping(address => mapping(address => EnumerableSet.UintSet))
    internal _userBiddedTokens;
  mapping(address => mapping(address => mapping(uint256 => uint256)))
    internal _userBids;
  mapping(address => mapping(uint256 => EnumerableSet.AddressSet))
    internal _tokenBidders;

  uint256 internal MAX_DAYS;
  uint256 internal _pendingFunds;
  bool internal _panicSwitch;
  address internal _collectionManager;

  event BuyOfferCreated(
    address indexed bidder,
    address indexed contractAddress,
    uint32 indexed tokenId,
    uint256 bid
  );

  event BuyOfferStatusChanged(
    address indexed bidder,
    address indexed contractAddress,
    uint32 indexed tokenId,
    uint256 bid,
    bool accepted
  );

  constructor(
    uint256 maxDays_,
    address collectionManager_,
    address trustedForwarder_
  ) ERC2771Context(trustedForwarder_) {
    _panicSwitch = false;
    _pendingFunds = 0;
    MAX_DAYS = maxDays_;
    _collectionManager = collectionManager_;
  }

  /// @notice Create a Buy Offer for an NFT
  /// @param contractAddress_ address of the NFT Collection
  /// @param tokenId_ ID of the token
  /// @dev Users can't create a Buy Offer for listed Items or Auctioned Items.
  /// msg.value gets stored as the offer. Users can't add to previous offer or make a new offer without cancel old offer first.
  function createBuyOffer(address contractAddress_, uint32 tokenId_)
    public
    payable
    onlyNotPanic
  {
    onlyWhitelisted(contractAddress_);
    require(
      !_userBiddedTokens[_msgSender()][contractAddress_].contains(tokenId_),
      "You already have an offer for this item"
    );
    require(msg.value > 0, "Price must be at least 1 wei");

    _addBuyOffer(_msgSender(), contractAddress_, tokenId_, msg.value);

    _pendingFunds += msg.value;

    emit BuyOfferCreated(_msgSender(), contractAddress_, tokenId_, msg.value);
  }

  /// @notice Cancels a Buy Offer for the specified NFT
  /// @param contractAddress_ address of the NFT Collection
  /// @param tokenId_ ID of the token
  function cancelBuyOffer(address contractAddress_, uint32 tokenId_)
    public
    nonReentrant
  {
    require(
      _userBiddedTokens[_msgSender()][contractAddress_].contains(tokenId_),
      "No active offer found"
    );
    uint256 bid = _userBids[_msgSender()][contractAddress_][tokenId_];
    _destroyBuyOffer(_msgSender(), contractAddress_, tokenId_);

    _pendingFunds -= bid;

    emit BuyOfferStatusChanged(
      _msgSender(),
      contractAddress_,
      tokenId_,
      bid,
      false
    );

    Address.sendValue(payable(_msgSender()), bid);
  }

  /// @notice Accept a Buy Offer from other user
  /// @param contractAddress_ address of the NFT Collection
  /// @param tokenId_ ID of the token
  /// @param bidder_ user that placed the Buy Offer
  /// @dev To avoid conflicts, Buy Offers can only be accepted if NFT is not a MarketItem or an AuctionItem.
  /// This means that no MarketItem or AuctionItem should be deleted after accepting.
  function acceptBuyOffer(
    address contractAddress_,
    uint32 tokenId_,
    address bidder_
  ) public nonReentrant {
    require(
      _userBiddedTokens[bidder_][contractAddress_].contains(tokenId_),
      "No active offer found"
    );
    uint256 bid = _userBids[bidder_][contractAddress_][tokenId_];
    emit BuyOfferStatusChanged(bidder_, contractAddress_, tokenId_, bid, true);

    _destroyBuyOffer(bidder_, contractAddress_, tokenId_);

    _pendingFunds -= bid;

    // Payment & fee calculation
    uint256 paymentToSeller = bid - _calculateFee(bid, contractAddress_);

    //NFT transfer. Fails if msg sender is not the owner of NFT.
    IERC721(contractAddress_).safeTransferFrom(_msgSender(), bidder_, tokenId_);

    Address.sendValue(payable(_msgSender()), paymentToSeller);
  }

  function bidOfUserByIndex(
    address user_,
    address contractAddress_,
    uint256 index_
  ) public view returns (uint256 bid) {
    require(
      index_ < _userBiddedTokens[user_][contractAddress_].length(),
      "User Bid index out of bounds"
    );
    uint256 tokenId = _userBiddedTokens[user_][contractAddress_].at(index_);
    return _userBids[user_][contractAddress_][tokenId];
  }

  function getUserBidsCount(address user_, address contractAddress_)
    public
    view
    returns (uint256)
  {
    return _userBiddedTokens[user_][contractAddress_].length();
  }

  function bidByIndex(
    address contractAddress_,
    uint256 tokenId_,
    uint256 index_
  ) public view returns (address user, uint256 bid) {
    require(
      index_ < _tokenBidders[contractAddress_][tokenId_].length(),
      "Bid index out of bounds"
    );
    user = _tokenBidders[contractAddress_][tokenId_].at(index_);
    return (user, _userBids[user][contractAddress_][tokenId_]);
  }

  function getAllBidsCount(address contractAddress_, uint256 tokenId_)
    public
    view
    returns (uint256)
  {
    return _tokenBidders[contractAddress_][tokenId_].length();
  }

  /// @notice Retrieve payed secondary sales fees.
  function transferSalesFees() public onlyOwner nonReentrant {
    uint256 salesFees = address(this).balance - _pendingFunds;
    require(salesFees > 0, "No sales fees to retrieve");

    Address.sendValue(payable(owner()), salesFees);
  }

  function setPanicSwitch(bool status_) public onlyOwner {
    _panicSwitch = status_;
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

  function _addBuyOffer(
    address user_,
    address contractAddress_,
    uint256 tokenId_,
    uint256 bid_
  ) internal {
    _userBids[user_][contractAddress_][tokenId_] = bid_;
    _userBiddedTokens[user_][contractAddress_].add(tokenId_);
    _tokenBidders[contractAddress_][tokenId_].add(user_);
  }

  function _destroyBuyOffer(
    address user_,
    address contractAddress_,
    uint256 tokenId_
  ) internal {
    delete _userBids[user_][contractAddress_][tokenId_];
    _userBiddedTokens[user_][contractAddress_].remove(tokenId_);
    _tokenBidders[contractAddress_][tokenId_].remove(user_);
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

  modifier onlyNotPanic() {
    require(!_panicSwitch, "Something went wrong");
    _;
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
