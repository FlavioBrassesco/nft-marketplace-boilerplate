//SPDX-License-Identifier: GNU GPLv3 
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/INFTCollectionManager.sol";
import "./interfaces/ISalesService.sol";

/// @title NFT Marketplace's Auction support
/// @author Flavio Brassesco
/// @dev Users are required to send msg.value when creating a bid. Only max bid gets stored.
/// Users can't cancel bids, bids can only get cancelled once another higher bid is created.
/// Users can't cancel an auction and higher bid always gets the NFT.
/// Users must retrieve their money manually by calling retrievePendingFunds()
contract NFTAuctions is
    ReentrancyGuard,
    Ownable,
    Pausable,
    ERC721Holder,
    ERC2771Context
{
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

    uint256 internal MAX_DAYS;
    INFTCollectionManager internal CollectionManager;
    ISalesService internal SalesService;
    address _trustedForwarder;

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
        address salesService_,
        address trustedForwarder_
    ) ERC2771Context(trustedForwarder_) {
        MAX_DAYS = maxDays_;
        CollectionManager = INFTCollectionManager(collectionManager_);
        SalesService = ISalesService(salesService_);
        _trustedForwarder = trustedForwarder_;
    }

    function createMarketAuction(
        address contractAddress_,
        uint256 tokenId_,
        uint256 floorPrice_,
        uint256 days_
    ) public nonReentrant whenNotPaused {
        onlyWhitelisted(contractAddress_);
        require(floorPrice_ > 0, "Floor price must be > 0");
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

    function bid(
        address contractAddress_,
        uint256 tokenId_,
        address tokenAddress_,
        uint256 amountIn_
    ) public payable nonReentrant whenNotPaused {
        require(
            _auctionItems[contractAddress_][tokenId_].seller != _msgSender(),
            "Seller is not authorized"
        );
        require(
            _msgSender() !=
                _auctionItems[contractAddress_][tokenId_].currentBidder,
            "Current bidder is not authorized"
        );
        require(
            _auctionItems[contractAddress_][tokenId_].endsAt > 0 &&
                block.timestamp <
                _auctionItems[contractAddress_][tokenId_].endsAt,
            "Timestamp out of range"
        );

        AuctionItem memory auctionItem = _auctionItems[contractAddress_][
            tokenId_
        ];
        
        uint256 value;
        if (SalesService.BASE_CURRENCY() != address(0)) {
            if (msg.value > 0) {
                value = SalesService.getAmountsOutMin(SalesService.WETH(), SalesService.BASE_CURRENCY(), msg.value);
            } else {
                value = SalesService.getAmountsOutMin(tokenAddress_, SalesService.BASE_CURRENCY(), amountIn_);
            }
        } else {
            if (msg.value == 0) {
                value = SalesService.getAmountsOutMin(tokenAddress_, SalesService.WETH(), amountIn_);
            } else {
                value = msg.value;
            }
        }

        if (auctionItem.currentBidder == address(0)) {
            require(
                value >= auctionItem.currentBid,
                "Your bid must be >= than floor price"
            );
        } else {
            require(
                value > auctionItem.currentBid,
                "Your bid must be higher than last bid"
            );
        }

        if (msg.value > 0) {
            SalesService.approvePayment{value: msg.value}(address(this), value, 0);
        } else {
            SalesService.approvePaymentERC20(
                _msgSender(),
                address(this),
                tokenAddress_,
                amountIn_,
                value,
                0
            );
        }

        _addAuctionBid(contractAddress_, tokenId_, _msgSender(), value);
    }

    function finishAuctionSale(address contractAddress_, uint256 tokenId_)
        public
        nonReentrant
    {
                require(_auctionItems[contractAddress_][tokenId_].endsAt > 0);
        require(
            block.timestamp > _auctionItems[contractAddress_][tokenId_].endsAt,
            "Auction must be finished"
        );
        if (
            _auctionItems[contractAddress_][tokenId_].seller == _msgSender() ||
            _auctionItems[contractAddress_][tokenId_].currentBidder ==
            _msgSender()
        ) {
            _finishAuctionSale(contractAddress_, tokenId_);
        } else {
            revert("Only Auction participants allowed");
        }
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

    function getAllItemsCount(address contractAddress_)
        public
        view
        returns (uint256)
    {
        return _collectionTokenIds[contractAddress_].length();
    }

    function setPanicSwitch(bool status_) public onlyOwner {
        if (status_) {
            Pausable._pause();
        } else {
            Pausable._unpause();
        }
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
        uint256 previousBid = _auctionItems[contractAddress_][tokenId_]
            .currentBid;

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

        // if it is not the first bid
        if (previousBidder != address(0)) {
            SalesService.unlockPendingRevenue(previousBidder, previousBid, 0);
        }
    }

    function _finishAuctionSale(address contractAddress_, uint256 tokenId_)
        internal
    {
        AuctionItem memory auctionItem = _auctionItems[contractAddress_][
            tokenId_
        ];
        address to;
        bool sold;

        // if there is an offer after auction ended
        if (auctionItem.currentBidder != address(0)) {
            to = auctionItem.currentBidder;
            sold = true;
            SalesService.unlockPendingRevenue(
                auctionItem.seller,
                auctionItem.currentBid,
                    CollectionManager.getFee(
                        contractAddress_
                    )
            );
        } else {
            // is not sold so we return the NFT.
            to = auctionItem.seller;
            sold = false;
        }

        emit AuctionItemTransfer(
            auctionItem.seller,
            to,
            contractAddress_,
            tokenId_,
            auctionItem.currentBid,
            sold
        );

        _destroyAuctionItem(auctionItem.seller, contractAddress_, tokenId_);

        IERC721(contractAddress_).safeTransferFrom(address(this), to, tokenId_);
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

    function onlyWhitelisted(address contractAddress_) internal view {
        require(
            CollectionManager.isWhitelistedCollection(
                contractAddress_
            ),
            "Contract is not whitelisted"
        );
    }
}
