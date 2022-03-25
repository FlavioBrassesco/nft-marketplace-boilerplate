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

/// @title NFT Marketplace's Auction support
/// @author Flavio Brassesco
/// @notice Adds support for running Auctions in NFT Marketplace
/// @dev Users are required to send msg.value when creating a bid. Only max bid gets stored.
/// Users can't cancel bids, bids can only get cancelled once another higher bid is created.
/// Users can't cancel an auction and higher bid always gets the NFT.
/// Users must retrieve their money manually by calling retrievePendingFunds()
contract NFTMarketplaceAuctions is
    ReentrancyGuard,
    Ownable,
    ERC721Holder,
    ContextMixin,
    NativeMetaTransactionCalldata,
    NFTMarketplaceHelpers
{
    using Counters for Counters.Counter;

    struct AuctionItem {
        address seller;
        address currentBidder;
        uint256 currentBid;
        uint256 endsAt;
    }

    mapping(uint256 => AuctionItem) internal _nftIdToAuctionItem;

    mapping(uint256 => uint256) internal _nftIds;
    mapping(uint256 => uint256) internal _nftIdsIndex;
    Counters.Counter internal _nftIdsCount;

    mapping(address => mapping(uint256 => uint256)) internal _userNftIds;
    mapping(address => mapping(uint256 => uint256)) internal _userNftIdsIndex;
    mapping(address => Counters.Counter) internal _userNftIdsCount;

    uint256 internal _pendingFunds;
    uint256 internal MAX_DAYS;
    bool internal _panicSwitch = false;

    /// @notice Logs when an NFT is Auctioned
    event AuctionItemCreated(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 price,
        uint256 endsAt
    );

    /// @notice Logs when a bid is created for an Auction
    event AuctionBidCreated(
        address indexed currentBidder,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 currentBid,
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

    string internal _name;
    address internal _contractManager;

    constructor(
        string memory name_,
        address contractManager_,
        uint256 maxDays_
    ) {
        _pendingFunds = 0;
        _name = name_;
        _contractManager = contractManager_;
        MAX_DAYS = maxDays_;
        _initializeEIP712(name_);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    /// @notice Starts an Auction for a given NFT
    /// @param floorPrice_ Floor price in wei
    /// @param days_ Duration in days. 1 to MAX_DAYS inclusive
    function createMarketAuction(
        address contractAddress_,
        uint32 tokenId_,
        uint256 floorPrice_,
        uint256 days_
    )
        public
        onlyNotPanic
        nonReentrant
        onlyWhitelistedContract(contractAddress_)
    {
        require(floorPrice_ > 0, "Floor price must be at least 1 wei");
        require(days_ >= 1 && days_ <= MAX_DAYS, "Duration out of bounds");

        uint256 nftId = _makeNftId(contractAddress_, tokenId_);

        _addAuctionItem(_msgSender(), nftId, floorPrice_, days_);

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

    function _addAuctionItem(
        address user_,
        uint256 nftId_,
        uint256 floorPrice_,
        uint256 days_
    ) internal {
        _nftIdToAuctionItem[nftId_] = AuctionItem(
            user_,
            address(0),
            floorPrice_,
            block.timestamp + (days_ * 24 * 60 * 60)
        );

        _nftIds[_nftIdsCount.current()] = nftId_;
        _nftIdsIndex[nftId_] = _nftIdsCount.current();

        _userNftIds[user_][_userNftIdsCount[user_].current()] = nftId_;
        _userNftIdsIndex[user_][nftId_] = _userNftIdsCount[user_].current();

        _nftIdsCount.increment();
        _userNftIdsCount[user_].increment();
    }

    /// @dev Destroys a created market item.
    /// @param sender_ address of the market item seller
    /// @param nftId_ NFT unique ID
    function _destroyAuctionItem(address sender_, uint256 nftId_) internal {
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
        delete _nftIdToAuctionItem[nftId_];
        _nftIdsCount.decrement();
        _userNftIdsCount[sender_].decrement();
    }

    /// @notice Start an auction and create a bid for a whitelisted NFT belonging to owner()
    /// @dev This allows the marketplace owner to list a batch of NFTs as sellable by Auction.
    /// Should be clarified to users that when placing a bid the auction will start with MAX_DAYS of duration.
    function createMarketOwnerAuction(
        address bidder_,
        address contractAddress_,
        uint32 tokenId_
    )
        public
        payable
        onlyOwner
        onlyNotPanic
        nonReentrant
        onlyWhitelistedContract(contractAddress_)
    {
        uint256 floorPrice = NFTMarketplaceContractManager(_contractManager)
            .getFloorPrice(contractAddress_);
        require(floorPrice > 0, "Floor price must be greater than 0");
        require(
            msg.value >= floorPrice,
            "Value sent must be greater than floor price"
        );

        uint256 nftId = _makeNftId(contractAddress_, tokenId_);

        _addAuctionItem(msgSender(), nftId, floorPrice, MAX_DAYS);

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
    function createAuctionBid(address contractAddress_, uint32 tokenId_)
        public
        payable
        nonReentrant
        onlyNotSeller(contractAddress_, tokenId_)
        onlyNotCurrentBidder(contractAddress_, tokenId_)
        onlyAuctionInProgress(contractAddress_, tokenId_)
    {
        uint256 nftId = _makeNftId(contractAddress_, tokenId_);
        if (_nftIdToAuctionItem[nftId].currentBidder == address(0)) {
            require(
                msg.value >= _nftIdToAuctionItem[nftId].currentBid,
                "Your bid must be equal or higher than floor price"
            );
        } else {
            require(
                msg.value > _nftIdToAuctionItem[nftId].currentBid,
                "Your bid must be higher than last bid"
            );
        }
        _addAuctionBid(contractAddress_, tokenId_, _msgSender(), msg.value);
    }

    function _addAuctionBid(
        address contractAddress_,
        uint32 tokenId_,
        address bidder_,
        uint256 bid_
    ) internal {
        uint256 nftId = _makeNftId(contractAddress_, tokenId_);

        // saving information to make external call after state change
        address previousBidder = _nftIdToAuctionItem[nftId].currentBidder;
        uint256 previousBid = _nftIdToAuctionItem[nftId].currentBid;

        //update general pending funds with this new bid
        _pendingFunds += bid_;

        _nftIdToAuctionItem[nftId].currentBid = bid_;
        _nftIdToAuctionItem[nftId].currentBidder = bidder_;
        //if remaining days for auction to end are < 1, then reset endsAt to now + 1 day;
        uint256 remainingSeconds = (_nftIdToAuctionItem[nftId].endsAt -
            block.timestamp);
        if (remainingSeconds < 86400) {
            _nftIdToAuctionItem[nftId].endsAt = block.timestamp + 1 days;
        }

        emit AuctionBidCreated(
            _nftIdToAuctionItem[nftId].currentBidder,
            contractAddress_,
            tokenId_,
            _nftIdToAuctionItem[nftId].currentBid,
            _nftIdToAuctionItem[nftId].endsAt
        );

        //if it is not the first bid
        if (previousBidder != address(0)) {
            _pendingFunds -= previousBid;

            _safeTransferValue(previousBidder, previousBid);
        }
    }

    /// @notice Finish an auction and receive payment
    function finishAuctionSale(address contractAddress_, uint32 tokenId_)
        public
        nonReentrant
        onlySeller(contractAddress_, tokenId_)
    {
        _finishAuctionSale(contractAddress_, tokenId_);
    }

    /// @notice Finish an auction and receive NFT
    function retrieveAuctionItem(address contractAddress_, uint32 tokenId_)
        public
        nonReentrant
        onlyCurrentBidder(contractAddress_, tokenId_)
    {
        _finishAuctionSale(contractAddress_, tokenId_);
    }

    /// @notice Retrieve payed secondary sales fees.
    function transferSalesFees() public onlyOwner nonReentrant {
        uint256 salesFees = address(this).balance - _pendingFunds;
        require(salesFees > 0, "No sales fees to retrieve");
        _safeTransferValue(owner(), salesFees);
    }

    function itemOfUserByIndex(address user_, uint256 index_)
        public
        view
        returns (AuctionItem memory)
    {
        require(
            index_ < _userNftIdsCount[user_].current(),
            "Index out of bounds"
        );
        uint256 nftId = _userNftIds[user_][index_];
        return _nftIdToAuctionItem[nftId];
    }

    /// @notice Returns amount of items listed by the seller
    function getUserItemsCount(address user_) public view returns (uint256) {
        return _userNftIdsCount[user_].current();
    }

    function itemByIndex(uint256 index_)
        public
        view
        returns (AuctionItem memory)
    {
        require(index_ < _nftIdsCount.current(), "Index out of bounds");
        uint256 nftId = _nftIds[index_];
        return _nftIdToAuctionItem[nftId];
    }

    /// @notice Returns total amount of items listed in the marketplace
    function getAllItemsCount() public view returns (uint256) {
        return _nftIdsCount.current();
    }

    ///@dev Finish an auction and retrieve funds / transfer NFT
    function _finishAuctionSale(address contractAddress_, uint32 tokenId_)
        private
        onlyAfterEnd(contractAddress_, tokenId_)
    {
        uint256 nftId = _makeNftId(contractAddress_, tokenId_);

        // saving information to make external calls after state change
        address seller = _nftIdToAuctionItem[nftId].seller;
        address to;
        bool sold;
        uint256 currentBid;

        //if there is an offer after auction ended
        if (_nftIdToAuctionItem[nftId].currentBidder != address(0)) {
            currentBid = _nftIdToAuctionItem[nftId].currentBid;
            to = _nftIdToAuctionItem[nftId].currentBidder;
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
            _nftIdToAuctionItem[nftId].currentBid,
            sold
        );

        _destroyAuctionItem(seller, nftId);

        IERC721(contractAddress_).safeTransferFrom(address(this), to, tokenId_);

        if (sold) {
            _pendingFunds -= currentBid;

            // Payment & fee calculation
            uint256 paymentToSeller = currentBid -
                Helpers._mulDiv(
                    NFTMarketplaceContractManager(_contractManager).getFee(
                        contractAddress_
                    ),
                    currentBid,
                    100
                );

            _safeTransferValue(seller, paymentToSeller);
        }
    }

    function _msgSender() internal view override returns (address) {
        return ContextMixin.msgSender();
    }

    modifier onlyCurrentBidder(address contractAddress_, uint32 tokenId_) {
        require(
            _msgSender() ==
                _nftIdToAuctionItem[_makeNftId(contractAddress_, tokenId_)]
                    .currentBidder,
            "Sender is not current bidder"
        );
        _;
    }

    modifier onlyNotCurrentBidder(address contractAddress_, uint32 tokenId_) {
        require(
            _msgSender() !=
                _nftIdToAuctionItem[_makeNftId(contractAddress_, tokenId_)]
                    .currentBidder,
            "Current bidder can't perform this action"
        );
        _;
    }

    modifier onlyAuctionInProgress(address contractAddress_, uint32 tokenId_) {
        require(
            _nftIdToAuctionItem[_makeNftId(contractAddress_, tokenId_)].endsAt >
                0 &&
                block.timestamp <
                _nftIdToAuctionItem[_makeNftId(contractAddress_, tokenId_)]
                    .endsAt,
            "Auction has not started or it's already finished"
        );
        _;
    }

    modifier onlyAfterEnd(address contractAddress_, uint32 tokenId_) {
        require(
            _nftIdToAuctionItem[_makeNftId(contractAddress_, tokenId_)].endsAt >
                0
        );
        require(
            block.timestamp >
                _nftIdToAuctionItem[_makeNftId(contractAddress_, tokenId_)]
                    .endsAt,
            "Auction must be finished to perform this action"
        );
        _;
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

    modifier onlyNotSeller(address contractAddress_, uint32 tokenId_) {
        require(
            _nftIdToAuctionItem[_makeNftId(contractAddress_, tokenId_)]
                .seller != _msgSender(),
            "Seller is not authorized"
        );
        _;
    }

    modifier onlySeller(address contractAddress_, uint32 tokenId_) {
        require(
            _nftIdToAuctionItem[_makeNftId(contractAddress_, tokenId_)]
                .seller == _msgSender(),
            "Only seller authorized"
        );
        _;
    }
}
