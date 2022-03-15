//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFTMarketplaceAuctions.sol";
import "./ActiveIndexes.sol";

/// @title NFT Marketplace's Buy Offer Support
/// @author Flavio Brassesco
/// @notice Adds support for unsolicited Buy offers in NFT Marketplace
/// @dev NFTMarketplaceAuctions is required.
/// Users can post an offer anytime and cancel anytime.
/// Owners can accept an offer anytime (Except if they are running an auction).
/// Offers are stored in a pool and refunded when cancelled.
/// Only bidder is enabled to cancel an offer. Offers don't limit the owner in any case.
/// Buy offers should dissappear from front end in case the owner inits an auction.
/// Is not possible to place a Buy offer for auction items.
contract NFTMarketplaceBuyOffer is NFTMarketplaceAuctions {
    using ActiveIndexes for ActiveIndexes.ActiveIndex;

    mapping(uint256 => uint256[]) internal _nftIDToBids;
    mapping(uint256 => address) internal _indexOf_nftIDToBids_user;

    mapping(address => mapping(uint256 => ActiveIndexes.ActiveIndex))
        internal _user_nftID_IndexOf_nftIDToBids;
    mapping(address => uint256[]) internal _userToNftIDsWithBids;
    mapping(address => mapping(uint256 => ActiveIndexes.ActiveIndex))
        internal _user_nftID_IndexOf_userToNftIDsWithBids;

    /// Only for viewing purposes
    struct BuyOffer {
        address contractAddress;
        address payable userAddress;
        uint32 tokenId;
        uint256 bid;
    }

    event BuyOfferCreated(
        address indexed bidder,
        address indexed nftContract,
        uint32 indexed tokenId,
        uint256 bid
    );
    event BuyOfferCancelled(
        address indexed bidder,
        address indexed nftContract,
        uint32 indexed tokenId,
        uint256 bid
    );
    event BuyOfferAccepted(
        address indexed bidder,
        address indexed nftContract,
        uint32 indexed tokenId,
        uint256 bid
    );

    /// @notice Create a Buy Offer for an NFT
    /// @param _NFTContract address of the NFT Collection
    /// @param _tokenId ID of the token
    /// @dev Users can't create a Buy Offer for listed Items or Auctioned Items.
    /// msg.value gets stored as the offer. Users can't add to previous offer or make a new offer without cancel old offer first.
    function createBuyOffer(address _NFTContract, uint32 _tokenId)
        public
        payable
        nonReentrant
        onlyNotListed(_NFTContract, _tokenId)
        onlyNotBlockedItem(_NFTContract, _tokenId)
        onlyNotAuction(_NFTContract, _tokenId)
    {
        require(msg.value > 0, "Price must be at least 1 wei");

        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        require(
            !_user_nftID_IndexOf_userToNftIDsWithBids[payable(msg.sender)][
                nftID
            ].isActive(),
            "Offer for this listing already exists"
        );

        _user_nftID_IndexOf_nftIDToBids[payable(msg.sender)][nftID].storeIndex(
            _nftIDToBids[nftID].length
        );
        _indexOf_nftIDToBids_user[_nftIDToBids[nftID].length] = payable(
            msg.sender
        );
        _nftIDToBids[nftID].push(msg.value);

        _user_nftID_IndexOf_userToNftIDsWithBids[payable(msg.sender)][nftID]
            .storeIndex(_userToNftIDsWithBids[payable(msg.sender)].length);
        _userToNftIDsWithBids[payable(msg.sender)].push(nftID);

        _pendingFunds += msg.value;

        emit BuyOfferCreated(
            payable(msg.sender),
            _NFTContract,
            _tokenId,
            msg.value
        );
    }

    /// @notice Cancels a Buy Offer for the specified NFT
    /// @param _NFTContract address of the NFT Collection
    /// @param _tokenId ID of the token
    /// @dev Money gets into _userPendingFunds pool and should be retrieved by the user.
    function cancelBuyOffer(address _NFTContract, uint32 _tokenId)
        public
        nonReentrant
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);

        require(
            _user_nftID_IndexOf_nftIDToBids[payable(msg.sender)][nftID]
                .isActive(),
            "No active offer found."
        );

        uint256 boIndex = _user_nftID_IndexOf_nftIDToBids[payable(msg.sender)][
            nftID
        ].index();
        uint256 bid = _nftIDToBids[nftID][boIndex];
        uint256 uboIndex = _user_nftID_IndexOf_userToNftIDsWithBids[
            payable(msg.sender)
        ][nftID].index();

        //money gets into user pool. User must call retrievePendingFunds to transfer to his wallet
        _userToPendingFunds[payable(msg.sender)] += bid;

        emit BuyOfferCancelled(
            payable(msg.sender),
            _NFTContract,
            _tokenId,
            bid
        );

        delete _nftIDToBids[nftID][boIndex];
        delete _indexOf_nftIDToBids_user[boIndex];
        delete _userToNftIDsWithBids[payable(msg.sender)][uboIndex];

        delete _user_nftID_IndexOf_nftIDToBids[payable(msg.sender)][nftID];
        delete _user_nftID_IndexOf_userToNftIDsWithBids[payable(msg.sender)][
            nftID
        ];
    }

    /// @notice Accept a Buy Offer from other user
    /// @param _NFTContract address of the NFT Collection
    /// @param _tokenId ID of the token
    /// @param _bidder user that placed the Buy Offer
    /// @dev To avoid conflicts, Buy Offers can only be accepted if NFT is not a MarketItem or an AuctionItem.
    /// This means that no MarketItem or AuctionItem should be deleted after accepting.
    function acceptBuyOffer(
        address _NFTContract,
        uint32 _tokenId,
        address _bidder
    ) public payable nonReentrant onlyNotListed(_NFTContract, _tokenId) {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);

        require(
            _user_nftID_IndexOf_nftIDToBids[_bidder][nftID].isActive(),
            "No active offer found."
        );

        uint256 boIndex = _user_nftID_IndexOf_nftIDToBids[_bidder][nftID]
            .index();
        uint256 bid = _nftIDToBids[nftID][boIndex];
        uint256 uboIndex = _user_nftID_IndexOf_userToNftIDsWithBids[_bidder][
            nftID
        ].index();

        //NFT transfer. Fails if msg.sender is not the owner of NFT.
        IERC721(_NFTContract).transferFrom(msg.sender, _bidder, _tokenId);

        emit BuyOfferAccepted(_bidder, _NFTContract, _tokenId, bid);

        delete _nftIDToBids[nftID][boIndex];
        delete _indexOf_nftIDToBids_user[boIndex];
        delete _userToNftIDsWithBids[_bidder][uboIndex];

        delete _user_nftID_IndexOf_nftIDToBids[_bidder][nftID];
        delete _user_nftID_IndexOf_userToNftIDsWithBids[_bidder][nftID];

        _pendingFunds -= bid;
        // Payment & fee calculation
        uint256 fee = bid * (getFee(_NFTContract) / 10000);
        uint256 paymentToSeller = bid - fee;

        (bool success, ) = payable(msg.sender).call{value: paymentToSeller}("");
        require(success, "Transfer failed.");
    }

    /// @notice Returns all Buy Offers for a given NFT
    /// @param _NFTContract address of the NFT Collection
    /// @param _tokenId ID of the token
    /// @dev returns a tuplet of bids and address with sync'ed indexes
    function getNFTBuyOffers(address _NFTContract, uint32 _tokenId)
        public
        view
        returns (uint256[] memory, address[] memory)
    {
        uint256 nftID = makeNftID(_NFTContract, _tokenId);
        address[] memory users = new address[](_nftIDToBids[nftID].length);

        for (uint256 i = 0; i < _nftIDToBids[nftID].length; i++) {
            users[i] = _indexOf_nftIDToBids_user[i];
        }

        return (_nftIDToBids[nftID], users);
    }

    /// @notice Returns all Buy Offers placed by the user
    function getAllMyOffers()
        public
        view
        returns (BuyOffer[] memory buyOffers)
    {
        require(_userToNftIDsWithBids[msg.sender].length != 0);
        buyOffers = new BuyOffer[](_userToNftIDsWithBids[msg.sender].length);

        for (uint256 i = 0; i < _userToNftIDsWithBids[msg.sender].length; i++) {
            uint256 nftID = _userToNftIDsWithBids[msg.sender][i];
            uint256 htboIndex = _user_nftID_IndexOf_nftIDToBids[msg.sender][
                nftID
            ].index();
            uint256 bid = _nftIDToBids[nftID][htboIndex];

            buyOffers[i] = BuyOffer(
                address(uint160(nftID)),
                payable(msg.sender),
                uint32(nftID >> 160),
                bid
            );
        }
    }
}
