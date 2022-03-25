//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./ContextMixin.sol";
import "./NativeMetaTransactionCalldata.sol";
import "./NFTMarketplaceContractManager.sol";
import "./NFTMarketplaceHelpers.sol";
import "./Helpers.sol";

/// @title NFT Marketplace's Buy Offer Support
/// @author Flavio Brassesco
/// @notice Adds support for unsolicited Buy offers in NFT Marketplace
/// @dev Users can post an offer anytime and cancel anytime.
/// Owners can accept an offer anytime (Except if they are running an auction).
/// Offers are stored in a pool and refunded when cancelled.
/// Only bidder is enabled to cancel an offer. Offers don't limit the owner in any case.
/// Buy offers should dissappear from front end in case the owner inits an auction.
/// Is not possible to place a Buy offer for auction items.
contract NFTMarketplaceBuyOffer is
    ReentrancyGuard,
    Ownable,
    ERC721Holder,
    ContextMixin,
    NativeMetaTransactionCalldata,
    NFTMarketplaceHelpers
{
    using Counters for Counters.Counter;

    mapping(uint256 => uint256) internal _idToBid;
    mapping(uint256 => uint256) internal _idToNftId;
    Counters.Counter internal _allBidsCount;

    mapping(address => mapping(uint256 => uint256)) internal _userBids;
    mapping(address => mapping(uint256 => uint256)) _userBidsIndex;
    mapping(address => Counters.Counter) internal _userBidsCount;

    mapping(uint256 => mapping(uint256 => uint256)) internal _nftIdBids;
    mapping(uint256 => mapping(uint256 => uint256)) internal _nftIdBidsIndex;
    mapping(uint256 => Counters.Counter) internal _nftIdBidsCount;

    mapping(address => mapping(uint256 => uint256)) _userNftIdToBids;

    event BuyOfferCreated(
        address indexed bidder,
        address indexed contractAddress,
        uint32 indexed tokenId,
        uint256 bid
    );

    event BuyOfferStatus(
        address indexed bidder,
        address indexed contractAddress,
        uint32 indexed tokenId,
        uint256 bid,
        bool accepted
    );

    string internal _name;
    address internal _contractManager;
    uint256 internal MAX_DAYS;
    uint256 internal _pendingFunds;
    bool internal _panicSwitch;

    constructor(
        string memory name_,
        address contractManager_,
        uint256 maxDays_
    ) {
        _panicSwitch = false;
        _pendingFunds = 0;
        _name = name_;
        _contractManager = contractManager_;
        MAX_DAYS = maxDays_;
        _initializeEIP712(name_);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    /// @notice Create a Buy Offer for an NFT
    /// @param contractAddress_ address of the NFT Collection
    /// @param tokenId_ ID of the token
    /// @dev Users can't create a Buy Offer for listed Items or Auctioned Items.
    /// msg.value gets stored as the offer. Users can't add to previous offer or make a new offer without cancel old offer first.
    function createBuyOffer(address contractAddress_, uint32 tokenId_)
        public
        payable
    {
        require(msg.value > 0, "Price must be at least 1 wei");

        uint256 nftId = _makeNftId(contractAddress_, tokenId_);
        uint256 indexOfIdToBid = _userNftIdToBids[_msgSender()][nftId];
        require(
            _idToBid[indexOfIdToBid] == 0,
            "Offer for this listing already exists"
        );

        _addBuyOffer(_msgSender(), nftId, msg.value);

        _pendingFunds += msg.value;

        emit BuyOfferCreated(
            _msgSender(),
            contractAddress_,
            tokenId_,
            msg.value
        );
    }

    /// @notice Cancels a Buy Offer for the specified NFT
    /// @param contractAddress_ address of the NFT Collection
    /// @param tokenId_ ID of the token
    function cancelBuyOffer(address contractAddress_, uint32 tokenId_)
        public
        nonReentrant
    {
        uint256 nftId = _makeNftId(contractAddress_, tokenId_);
        uint256 indexOfIdToBid = _userNftIdToBids[_msgSender()][nftId];
        uint256 bid = _idToBid[indexOfIdToBid];
        require(bid > 0, "No active offer found.");

        _destroyBuyOffer(_msgSender(), nftId, indexOfIdToBid);

        _pendingFunds -= bid;

        emit BuyOfferStatus(
            _msgSender(),
            contractAddress_,
            tokenId_,
            bid,
            false
        );

        _safeTransferValue(_msgSender(), bid);
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
        uint256 nftId = _makeNftId(contractAddress_, tokenId_);
        uint256 indexOfIdToBid = _userNftIdToBids[bidder_][nftId];
        uint256 bid = _idToBid[indexOfIdToBid];
        require(bid > 0, "No active offer found.");

        emit BuyOfferStatus(bidder_, contractAddress_, tokenId_, bid, true);

        _destroyBuyOffer(bidder_, nftId, indexOfIdToBid);

        _pendingFunds -= bid;

        // Payment & fee calculation
        uint256 paymentToSeller = bid -
            Helpers._mulDiv(
                NFTMarketplaceContractManager(_contractManager).getFee(
                    contractAddress_
                ),
                bid,
                100
            );

        //NFT transfer. Fails if msg sender is not the owner of NFT.
        IERC721(contractAddress_).safeTransferFrom(
            _msgSender(),
            bidder_,
            tokenId_
        );

        _safeTransferValue(_msgSender(), paymentToSeller);
    }

    function bidOfUserByIndex(address user_, uint256 index_)
        public
        view
        returns (uint256 nftId, uint256 bid)
    {
        require(
            index_ < _userBidsCount[user_].current(),
            "User Bid index out of bounds"
        );
        uint256 indexOfBid = _userBids[user_][index_];
        return (_idToNftId[indexOfBid], _idToBid[indexOfBid]);
    }

    function getUserBidsCount(address user_) public view returns (uint256) {
        return _userBidsCount[user_].current();
    }

    function bidByIndex(uint256 index_)
        public
        view
        returns (uint256 nftId, uint256 bid)
    {
        require(index_ < _allBidsCount.current(), "Bid index out of bounds");
        return (_idToNftId[index_], _idToBid[index_]);
    }

    function getAllBidsCount() public view returns (uint256) {
        return _allBidsCount.current();
    }

    function bidOfNftIdByIndex(uint256 nftId_, uint256 index_)
        public
        view
        returns (uint256)
    {
        require(index_ < _nftIdBidsCount[nftId_].current());
        uint256 indexOfBid = _nftIdBids[nftId_][index_];
        return _idToBid[indexOfBid];
    }

    function getNftIdBidsCount(uint256 nftId_) public view returns (uint256) {
        return _nftIdBidsCount[nftId_].current();
    }

    /// @notice Retrieve payed secondary sales fees.
    function transferSalesFees() public onlyOwner nonReentrant {
        uint256 salesFees = address(this).balance - _pendingFunds;
        require(salesFees > 0, "No sales fees to retrieve");

        _safeTransferValue(owner(), salesFees);
    }

    function _addBuyOffer(
        address user_,
        uint256 nftId_,
        uint256 bid_
    ) internal {
        _idToBid[_allBidsCount.current()] = bid_;
        _idToNftId[_allBidsCount.current()] = nftId_;

        _userBids[user_][_userBidsCount[user_].current()] = _allBidsCount
            .current();
        _nftIdBids[nftId_][_nftIdBidsCount[nftId_].current()] = _allBidsCount
            .current();

        _userBidsIndex[user_][_allBidsCount.current()] = _userBidsCount[user_]
            .current();
        _nftIdBidsIndex[nftId_][_allBidsCount.current()] = _nftIdBidsCount[
            nftId_
        ].current();

        _allBidsCount.increment();
        _userBidsCount[user_].increment();
        _nftIdBidsCount[nftId_].increment();
    }

    function _destroyBuyOffer(
        address user_,
        uint256 nftId_,
        uint256 indexOfIdToBid_
    ) internal {
        uint256 indexOfUserBids = _userBidsIndex[user_][indexOfIdToBid_];
        uint256 indexOfNftIdBids = _nftIdBidsIndex[nftId_][indexOfIdToBid_];

        if (indexOfIdToBid_ != _allBidsCount.current() - 1) {
            uint256 lastBid = _idToBid[_allBidsCount.current() - 1];
            _idToBid[indexOfIdToBid_] = lastBid;
            uint256 lastNftId = _idToNftId[_allBidsCount.current() - 1];
            _idToNftId[indexOfIdToBid_] = lastNftId;
        }
        delete _idToBid[_allBidsCount.current() - 1];
        delete _idToNftId[_allBidsCount.current() - 1];
        _allBidsCount.decrement();

        if (indexOfUserBids != _userBidsCount[user_].current() - 1) {
            uint256 lastBidIndex = _userBids[user_][
                _userBidsCount[user_].current() - 1
            ];
            _userBids[user_][indexOfUserBids] = lastBidIndex;
        }
        delete _userBids[user_][_userBidsCount[user_].current() - 1];
        _userBidsCount[user_].decrement();

        if (indexOfNftIdBids != _nftIdBidsCount[nftId_].current() - 1) {
            uint256 lastBidIndex = _nftIdBids[nftId_][
                _nftIdBidsCount[nftId_].current() - 1
            ];
            _nftIdBids[nftId_][indexOfNftIdBids] = lastBidIndex;
        }
        delete _nftIdBids[nftId_][_nftIdBidsCount[nftId_].current() - 1];
        _nftIdBidsCount[nftId_].decrement();
    }

    function _msgSender() internal view override returns (address) {
        return ContextMixin.msgSender();
    }

    modifier onlyWhitelistedContract(address contractAddress_) {
        require(
            NFTMarketplaceContractManager(_contractManager)
                .isWhitelistedNFTContract(contractAddress_),
            "Contract is not auctionable"
        );
        _;
    }

    modifier onlyNotPanic() {
        require(!_panicSwitch, "Something went wrong");
        _;
    }
}
