//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFTMarketplace.sol";

/// @title NFT Marketplace's Auction support
/// @author Flavio Brassesco
/// @notice Adds support for running Auctions in NFT Marketplace
/// @dev Users are required to send msg.value when creating a bid. Only max bid gets stored.
/// Users can't cancel bids, bids can only get cancelled once another higher bid is created.
/// Users can't cancel an auction and higher bid always gets the NFT.
/// Cancelled bids get stored in _userToPendingFunds pool.
/// Users must retrieve their money manually by calling retrievePendingFunds()
contract NFTMarketplaceAuctions is NFTMarketplace {
    using Counters for Counters.Counter;

    struct AuctionItem {
        uint256 currentBid;
        uint256 endsAt;
        address currentBidder;
    }

    mapping(uint256 => AuctionItem) internal _nftIDToAuctionItem;
    mapping(address => uint256) internal _userToPendingFunds;
    mapping(address => bool) internal _isAuctionableNFTContract;

    uint256 internal _pendingFunds;

    uint256 internal constant MAX_DAYS = 7;

    /// @notice Logs when an NFT is Auctioned
    event AuctionItemCreated(uint256 indexed itemId, uint256 indexed endsAt);

    /// @notice Logs when a bid is created for an Auction
    event AuctionBidCreated(
        uint256 indexed itemId,
        uint256 indexed currentBid,
        address indexed currentBidder,
        uint256 endsAt
    );

    constructor(string memory name_) NFTMarketplace(name_) {
        _pendingFunds = 0;
    }

    modifier onlyCurrentBidder(address _NFTContract, uint32 _tokenId) {
        //uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            _msgSender() ==
                _nftIDToAuctionItem[makeNftID(_NFTContract, _tokenId)]
                    .currentBidder,
            "Sender is not current bidder"
        );
        _;
    }

    modifier onlyNotCurrentBidder(address _NFTContract, uint32 _tokenId) {
        //uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            _msgSender() !=
                _nftIDToAuctionItem[makeNftID(_NFTContract, _tokenId)]
                    .currentBidder,
            "Current bidder can't perform this action"
        );
        _;
    }

    modifier onlyAfterStart(address _NFTContract, uint32 _tokenId) {
        //uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            _nftIDToAuctionItem[makeNftID(_NFTContract, _tokenId)].endsAt > 0,
            "Auction has not started or it's already finished"
        );
        _;
    }

    modifier onlyBeforeEnd(address _NFTContract, uint32 _tokenId) {
        //uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            block.timestamp <
                _nftIDToAuctionItem[makeNftID(_NFTContract, _tokenId)].endsAt,
            "Auction already finished"
        );
        _;
    }

    modifier onlyAfterEnd(address _NFTContract, uint32 _tokenId) {
        //uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            _nftIDToAuctionItem[makeNftID(_NFTContract, _tokenId)].endsAt > 0
        );
        require(
            block.timestamp >
                _nftIDToAuctionItem[makeNftID(_NFTContract, _tokenId)].endsAt,
            "Auction must be finished to perform this action"
        );
        _;
    }

    modifier onlyNotAuction(address _NFTContract, uint32 _tokenId) {
        //uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            unpackMarketItemStatus(
                _nftIDToMarketItem[makeNftID(_NFTContract, _tokenId)].packedData
            ) != Status.AUCTION,
            "Auction item is not allowed"
        );
        _;
    }

    modifier onlyAuction(address _NFTContract, uint32 _tokenId) {
        //uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            unpackMarketItemStatus(
                _nftIDToMarketItem[makeNftID(_NFTContract, _tokenId)].packedData
            ) == Status.AUCTION,
            "Item is not for Auction"
        );
        _;
    }

    modifier onlySenderWithPendingFunds() {
        require(
            _userToPendingFunds[_msgSender()] > 0,
            "User has not pending funds"
        );
        _;
    }

    modifier onlyAuctionWhitelistedContract(address _NFTContract) {
        require(
            _isAuctionableNFTContract[_NFTContract],
            "Contract is not auctionable"
        );
        _;
    }

    modifier onlyNotAuctionWhitelistedContract(address _NFTContract) {
        require(
            !_isAuctionableNFTContract[_NFTContract],
            "Contract must not be auctionable"
        );
        _;
    }

    /// @notice Adds a contract address to the Auction whitelist
    function addContractToAuctionWhitelist(address _NFTContract)
        public
        onlyOwner
        onlyWhitelistedContract(_NFTContract)
    {
        require(_NFTContract != address(0), "Can't add address(0)");
        _isAuctionableNFTContract[_NFTContract] = true;
    }

    /// @notice Removes a contract address from the Auction whitelist
    function removeContractFromAuctionWhitelist(address _NFTContract)
        public
        onlyOwner
    {
        require(_NFTContract != address(0), "Can't remove address(0)");
        delete _isAuctionableNFTContract[_NFTContract];
    }

    /// @dev Overrided function removes contract address from Auction whitelist and general Whitelist
    function removeWhitelistedNFTContract(address _contractAddress)
        public
        override
        onlyOwner
    {
        super.removeWhitelistedNFTContract(_contractAddress);
        delete _isAuctionableNFTContract[_contractAddress];
    }

    /// @notice Starts an Auction for a given NFT
    /// @param _floorPrice Floor price in wei
    /// @param _days Duration in days. 1 to MAX_DAYS inclusive
    function createMarketAuction(
        address _NFTContract,
        uint32 _tokenId,
        uint256 _floorPrice,
        uint256 _days
    )
        public
        nonReentrant
        onlyAuctionWhitelistedContract(_NFTContract)
        onlyNotListed(_NFTContract, _tokenId)
        returns (uint256)
    {
        require(_floorPrice > 0, "Floor price must be at least 1 wei");
        require(_days >= 1 && _days <= MAX_DAYS, "Duration out of bounds");

        _itemIDs.increment();

        uint256 nftID = makeNftID(_NFTContract, _tokenId);

        uint256 packedData = 0;
        packedData |= uint160(_NFTContract);
        packedData |= uint256(_tokenId) << 160;
        packedData |= uint256(uint32(_itemIDs.current())) << 192;
        packedData |= uint256(Status.AUCTION) << 224;

        _nftIDToMarketItem[nftID] = MarketItem(
            packedData,
            _floorPrice,
            _msgSender()
        );

        _nftIDToAuctionItem[nftID] = AuctionItem(
            0,
            block.timestamp + (_days * 24 * 60 * 60),
            address(0)
        );

        emit MarketItemCreated(
            uint32(_itemIDs.current()),
            _tokenId,
            _floorPrice,
            _NFTContract,
            _msgSender()
        );

        emit AuctionItemCreated(
            uint32(_itemIDs.current()),
            _nftIDToAuctionItem[nftID].endsAt
        );

        //NFT transfer from msg sender to this contract
        IERC721(_NFTContract).safeTransferFrom(
            _msgSender(),
            address(this),
            _tokenId
        );

        _activeItemsCount.increment();
        _sellerToListedItemsCount[_msgSender()].increment();

        return uint32(_itemIDs.current());
    }

    /// @notice Start an auction and create a bid for a whitelisted NFT belonging to owner()
    /// @dev This allows the marketplace owner to list a batch of NFTs as sellable by Auction.
    /// Should be clarified to users that when placing a bid the auction will start with MAX_DAYS of duration.
    /// ! A bot could easily buy an NFT that is meant to be auctioned simply by calling createMarketOwnerSale().
    function createMarketOwnerAuction(address _NFTContract, uint32 _tokenId)
        public
        payable
        nonReentrant
        onlyAuctionWhitelistedContract(_NFTContract)
        returns (uint256)
    {
        require(
            _NFTContractToFloorPrice[_NFTContract] > 0,
            "Floor price must be greater than 0"
        );
        require(
            msg.value >= _NFTContractToFloorPrice[_NFTContract],
            "Value sent must be greater than floor price"
        );

        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            unpackMarketItemStatus(_nftIDToMarketItem[nftID].packedData) ==
                Status.NONE,
            "Item not allowed"
        );

        _itemIDs.increment();
        uint256 packedData = uint256(0);
        packedData |= uint160(_NFTContract);
        packedData |= uint256(_tokenId) << 160;
        packedData |= uint256(uint32(_itemIDs.current())) << 192;
        packedData |= uint256(Status.AUCTION) << 224;

        _nftIDToMarketItem[nftID] = MarketItem(
            packedData,
            _NFTContractToFloorPrice[_NFTContract],
            owner()
        );

        _nftIDToAuctionItem[nftID] = AuctionItem(
            msg.value,
            block.timestamp + (MAX_DAYS * 24 * 60 * 60),
            _msgSender()
        );

        emit MarketItemCreated(
            uint32(_itemIDs.current()),
            _tokenId,
            _NFTContractToFloorPrice[_NFTContract],
            _NFTContract,
            owner()
        );

        emit AuctionItemCreated(
            uint32(_itemIDs.current()),
            _nftIDToAuctionItem[nftID].endsAt
        );
        emit AuctionBidCreated(
            uint32(_itemIDs.current()),
            msg.value,
            _msgSender(),
            _nftIDToAuctionItem[nftID].endsAt
        );

        //NFT owner must be the same as this contract
        IERC721(_NFTContract).safeTransferFrom(
            owner(),
            address(this),
            _tokenId
        );

        _activeItemsCount.increment();
        _pendingFunds += msg.value;

        return uint32(_itemIDs.current());
    }

    /// @notice Creates a bid for a given NFT
    /// @dev Only highest bid is saved for a given NFT Auction.
    function createAuctionBid(address _NFTContract, uint32 _tokenId)
        public
        payable
        nonReentrant
        onlyNotSeller(_NFTContract, _tokenId)
        onlyAfterStart(_NFTContract, _tokenId)
        onlyBeforeEnd(_NFTContract, _tokenId)
        onlyNotCurrentBidder(_NFTContract, _tokenId)
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);

        require(
            msg.value > _nftIDToMarketItem[nftID].price &&
                msg.value > _nftIDToAuctionItem[nftID].currentBid,
            "Your bid must be higher than last bid"
        );

        //if it is not the first bid
        if (_nftIDToAuctionItem[nftID].currentBidder != address(0)) {
            address previousBidder = _nftIDToAuctionItem[nftID].currentBidder;
            uint256 previousBid = _nftIDToAuctionItem[nftID].currentBid;
            //update pending funds for previousBidder
            _userToPendingFunds[previousBidder] += previousBid;
        }

        //update general pending funds with this new bid
        _pendingFunds += msg.value;

        _nftIDToAuctionItem[nftID].currentBid = msg.value;
        _nftIDToAuctionItem[nftID].currentBidder = _msgSender();
        //if remaining days for auction to end are < 1, then reset endsAt to now + 1 day;
        uint256 remainingSeconds = (_nftIDToAuctionItem[nftID].endsAt -
            block.timestamp);
        if (remainingSeconds < 86400) {
            _nftIDToAuctionItem[nftID].endsAt = block.timestamp + 1 days;
        }

        emit AuctionBidCreated(
            unpackMarketItemItemId(_nftIDToMarketItem[nftID].packedData),
            _nftIDToAuctionItem[nftID].currentBid,
            _nftIDToAuctionItem[nftID].currentBidder,
            _nftIDToAuctionItem[nftID].endsAt
        );
    }

    /// @notice creates a bid for a given NFT using user's pending funds.
    /// @param _askingPrice intended new bid. Should be <= user's pending funds + msg.value
    function sumToPreviousBid(
        address _NFTContract,
        uint32 _tokenId,
        uint256 _askingPrice
    )
        public
        payable
        nonReentrant
        onlyNotSeller(_NFTContract, _tokenId)
        onlyAfterStart(_NFTContract, _tokenId)
        onlyBeforeEnd(_NFTContract, _tokenId)
        onlyNotCurrentBidder(_NFTContract, _tokenId)
        onlySenderWithPendingFunds
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        //if what address sends along with his pending funds is enough
        require(
            (_userToPendingFunds[_msgSender()] + msg.value) >= _askingPrice,
            "Not enough funds to cover current bid"
        );
        require(
            _askingPrice > _nftIDToAuctionItem[nftID].currentBid,
            "Asking price must be bigger than current bid"
        );
        require(
            msg.value < _askingPrice,
            "Value sent must be lower than Asking Price"
        );

        //calculate how much from user pending funds is part of this new bid
        uint256 substractFromPending = _askingPrice - msg.value;
        //substract that amount from user pending funds
        _userToPendingFunds[_msgSender()] -= substractFromPending;

        //add msg.value to general pending funds
        _pendingFunds += msg.value;

        //update pending funds for previousBidder
        address previousBidder = _nftIDToAuctionItem[nftID].currentBidder;
        uint256 previousBid = _nftIDToAuctionItem[nftID].currentBid;
        _userToPendingFunds[previousBidder] += previousBid;

        _nftIDToAuctionItem[nftID].currentBid = _askingPrice;
        _nftIDToAuctionItem[nftID].currentBidder = _msgSender();

        //if remaining days for auction to end are < 1, then reset endsAt to now + 1 day;
        uint256 remainingSeconds = (_nftIDToAuctionItem[nftID].endsAt -
            block.timestamp);
        if (remainingSeconds < 86400) {
            _nftIDToAuctionItem[nftID].endsAt = block.timestamp + 1 days;
        }

        emit AuctionBidCreated(
            unpackMarketItemItemId(_nftIDToMarketItem[nftID].packedData),
            _nftIDToAuctionItem[nftID].currentBid,
            _nftIDToAuctionItem[nftID].currentBidder,
            _nftIDToAuctionItem[nftID].endsAt
        );
    }

    /// @notice Transfer user's pending funds to user
    function retrievePendingFunds()
        public
        nonReentrant
        onlyNotOwner
        onlySenderWithPendingFunds
    {
        uint256 userPendingFunds = _userToPendingFunds[_msgSender()];
        _userToPendingFunds[_msgSender()] = 0;
        _pendingFunds -= userPendingFunds;
        (bool success, ) = _msgSender().call{value: userPendingFunds}("");
        require(success, "Transfer failed.");
    }

    ///@dev Finish an auction and retrieve funds / transfer NFT
    function _finishAuctionSale(address _NFTContract, uint32 _tokenId)
        private
        onlyAfterEnd(_NFTContract, _tokenId)
        onlyAuction(_NFTContract, _tokenId)
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        address contractAddress = unpackMarketItemContract(
            _nftIDToMarketItem[nftID].packedData
        );
        uint256 tokenId = unpackMarketItemTokenId(
            _nftIDToMarketItem[nftID].packedData
        );
        uint256 itemId = unpackMarketItemItemId(
            _nftIDToMarketItem[nftID].packedData
        );
        //if there is an offer after auction ended
        if (
            _nftIDToAuctionItem[nftID].currentBidder != address(0) &&
            _nftIDToAuctionItem[nftID].currentBid != 0
        ) {
            address newOwner = _nftIDToAuctionItem[nftID].currentBidder;
            address seller = _nftIDToMarketItem[nftID].seller;
            uint256 payment = _nftIDToAuctionItem[nftID].currentBid;

            //NFT transfer
            IERC721(contractAddress).safeTransferFrom(
                address(this),
                newOwner,
                tokenId
            );

            emit MarketItemSold(
                itemId,
                tokenId,
                _nftIDToAuctionItem[nftID].currentBid,
                contractAddress,
                _nftIDToMarketItem[nftID].seller,
                _nftIDToAuctionItem[nftID].currentBidder
            );

            delete _nftIDToMarketItem[nftID];
            delete _nftIDToAuctionItem[nftID];

            _activeItemsCount.decrement();
            _sellerToListedItemsCount[seller].decrement();

            _pendingFunds -= payment;

            // Payment & fee calculation
            uint256 paymentToSeller = payment -
                mulDiv(getFee(_NFTContract), payment, 100);

            (bool success, ) = seller.call{value: paymentToSeller}("");
            require(success, "Transfer failed.");
        } else {
            //is not sold so we return the NFT.

            IERC721(contractAddress).safeTransferFrom(
                address(this),
                _nftIDToMarketItem[nftID].seller,
                tokenId
            );
            emit MarketItemCancelled(
                itemId,
                tokenId,
                _nftIDToMarketItem[nftID].price,
                contractAddress,
                _nftIDToMarketItem[nftID].seller
            );

            _activeItemsCount.decrement();
            _sellerToListedItemsCount[_nftIDToMarketItem[nftID].seller]
                .decrement();

            delete _nftIDToMarketItem[nftID];
            delete _nftIDToAuctionItem[nftID];
        }
    }

    /// @notice Finish an auction and receive payment
    function finishAuctionSale(address _NFTContract, uint32 _tokenId)
        public
        nonReentrant
        onlySeller(_NFTContract, _tokenId)
    {
        _finishAuctionSale(_NFTContract, _tokenId);
    }

    /// @notice Finish an auction and receive NFT
    function retrieveAuctionItem(address _NFTContract, uint32 _tokenId)
        public
        nonReentrant
        onlyCurrentBidder(_NFTContract, _tokenId)
    {
        _finishAuctionSale(_NFTContract, _tokenId);
    }

    /// @notice Returns items listed as Auction in the marketplace.
    /// @dev This is meant to be used for sync purposes only. Webapp should build a cache for all listed items.
    /// @param _page current page. Beware that for multiple calls this should equal the last returned item's ID + 1
    /// @param _amount amount of items to fetch
    function fetchItemsInAuction(uint256 _page, uint256 _amount)
        public
        view
        returns (MarketItem[] memory, AuctionItem[] memory)
    {
        MarketItem[] memory items = new MarketItem[](_amount);
        AuctionItem[] memory aItems = new AuctionItem[](_amount);

        uint256 counter = 0;
        for (uint256 i = _page; i <= _itemIDs.current(); i++) {
            uint256 nftID = _itemIDToNftID[i];
            if (
                unpackMarketItemStatus(_nftIDToMarketItem[nftID].packedData) ==
                Status.AUCTION
            ) {
                MarketItem storage currentItem = _nftIDToMarketItem[nftID];
                items[counter] = currentItem;
                AuctionItem storage currentAItem = _nftIDToAuctionItem[nftID];
                aItems[counter] = currentAItem;
                counter++;
                if (counter == _amount) break;
            }
        }

        return (items, aItems);
    }

    /// @notice Returns all items listed as Auction in the marketplace
    /// @dev The function with _page and _amount parameters is safer to use since this could eventually reach the block gas limit
    function fetchItemsInAuction()
        public
        view
        returns (MarketItem[] memory, AuctionItem[] memory)
    {
        return fetchItemsInAuction(0, _activeItemsCount.current());
    }

    /// @notice Retrieve payed secondary sales fees.
    /// @dev This override prevents owner to transfer pending funds in users pools
    function transferSalesFees() public override onlyOwner {
        uint256 pendingFunds = address(this).balance - _pendingFunds;
        require(pendingFunds > 0, "No pending funds to retrieve");
        (bool success, ) = owner().call{value: pendingFunds}("");
        require(success, "Transfer failed.");
    }
}
