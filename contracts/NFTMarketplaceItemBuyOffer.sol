//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFTMarketplaceAuctions.sol";

/**
@dev adds support for unsolicited buy offer
Users can post an offer anytime and cancel anytime
Owners can accept an offer anytime
Offers are stored in a pool and refunded when cancelled.

What happens when someone wants to put an item for sale or auction when it has offers?
offers should dissappear from front end in case of auction.
Only bidder should be able to cancel an offer. Offers don't limit the owner in any case.
Offers persist (eth persist in contract) as long as the bidder doesn't cancel the offer.

Not possible to place buy offer for auction items
acceptBuyOffer should have modifier onlyNotAuction onlyOwner

 */
contract NFTMarketplaceBuyOffer is NFTMarketplaceAuctions {
    using Counters for Counters.Counter;

    //item could be listed or not, so we need to store offer associated with nft hash
    //bytes32 hash => uint256[] offers NFTHashToBuyOffers[]
    //check if we have any offer (require NFTHashToBuyOffers[hash][0] != 0)
    //user address to offer in nft, so we need to reference nft hash and index in bids array
    //address => (bytes32 hash => uint256 index) userNFTBuyOfferIndex[address][hash]
    //we need also a way to get all nft that have offers from a user
    //address => bytes32[]
    //the getAllMyBuyOffers function should return hash and index, or a struct with {contractAddress, tokenId} & index (for deletion if required)

    mapping(bytes32 => uint256[]) internal NFTHashToBuyOffers;
    mapping(address => mapping(bytes32 => IndexBoolean))
        internal userToHashToBuyOffersIndex;
    mapping(address => bytes32[]) internal userToBuyOfferHashes;
    mapping(address => mapping(bytes32 => IndexBoolean))
        internal userToHashToBuyOfferHashesIndex;

    struct IndexBoolean {
        uint256 index;
        bool active;
    }

    struct BuyOffer {
        bytes32 hash;
        address nftContract;
        address payable userAddress;
        uint256 tokenId;
        uint256 utbohIndex;
        uint256 bid;
    }

    function getAllMyOffers()
        public
        view
        returns (BuyOffer[] memory buyOffers)
    {
        require(userToBuyOfferHashes[msg.sender].length != 0);
        buyOffers = new BuyOffer[](userToBuyOfferHashes[msg.sender].length);
        for (uint256 i = 0; i < userToBuyOfferHashes[msg.sender].length; i++) {
            bytes32 hash = userToBuyOfferHashes[msg.sender][i];
            uint256 htboIndex = userToHashToBuyOffersIndex[msg.sender][hash]
                .index;
            uint256 bid = NFTHashToBuyOffers[hash][htboIndex];
            NFTPair storage nftPair = nftHashToNFTPair[hash];
            buyOffers[i] = BuyOffer(
                hash,
                nftPair.nftContract,
                payable(msg.sender),
                nftPair.tokenId,
                i,
                bid
            );
        }
    }

    event BuyOfferCreated(
        address indexed bidder,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 bid
    );
    event BuyOfferCancelled(
        address indexed bidder,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 bid
    );
    event BuyOfferAccepted(
        address indexed bidder,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 bid
    );

    function createBuyOffer(address _NFTContract, uint256 _tokenId)
        public
        payable
        nonReentrant
        onlyNotListed(_NFTContract, _tokenId)
        onlyNotBlockedItem(_NFTContract, _tokenId)
    {
        require(msg.value > 0, "Price must be at least 1 wei");
        bytes32 hash = saveHash(_NFTContract, _tokenId);
        require(
            userToHashToBuyOfferHashesIndex[payable(msg.sender)][hash].active !=
                true,
            "Offer for this listing already exists"
        );

        userToHashToBuyOffersIndex[payable(msg.sender)][hash] = IndexBoolean(
            NFTHashToBuyOffers[hash].length,
            true
        );
        NFTHashToBuyOffers[hash].push(msg.value);

        userToHashToBuyOfferHashesIndex[payable(msg.sender)][
            hash
        ] = IndexBoolean(
            userToBuyOfferHashes[payable(msg.sender)].length,
            true
        );
        userToBuyOfferHashes[payable(msg.sender)].push(hash);

        _pendingWithdrawals += msg.value;

        emit BuyOfferCreated(
            payable(msg.sender),
            _NFTContract,
            _tokenId,
            msg.value
        );
    }

    function cancelBuyOffer(address _NFTContract, uint256 _tokenId)
        public
        nonReentrant
    {
        bytes32 hash = makeHash(_NFTContract, _tokenId);
        require(
            userToHashToBuyOfferHashesIndex[payable(msg.sender)][hash].active ==
                true,
            "No active offer found."
        );

        uint256 htboIndex = userToHashToBuyOffersIndex[payable(msg.sender)][
            hash
        ].index;
        uint256 bid = NFTHashToBuyOffers[hash][htboIndex];
        uint256 htbohIndex = userToHashToBuyOfferHashesIndex[
            payable(msg.sender)
        ][hash].index;

        //money gets into user pool. User must call retrievePendingFunds to transfer to his wallet
        addressToPendingWithdrawal[payable(msg.sender)] += bid;

        emit BuyOfferCancelled(
            payable(msg.sender),
            _NFTContract,
            _tokenId,
            bid
        );

        delete NFTHashToBuyOffers[hash][htboIndex];
        delete userToBuyOfferHashes[payable(msg.sender)][htbohIndex];
        delete userToHashToBuyOffersIndex[payable(msg.sender)][hash];
        delete userToHashToBuyOfferHashesIndex[payable(msg.sender)][hash];
    }

    //No hay forma de saber si el listing es un auction.
    function acceptBuyOffer(
        address _NFTContract,
        uint256 _tokenId,
        address _bidder
    ) public nonReentrant {
        bytes32 hash = makeHash(_NFTContract, _tokenId);
        require(
            userToHashToBuyOfferHashesIndex[payable(_bidder)][hash].active ==
                true,
            "No active offer found."
        );

        uint256 htboIndex = userToHashToBuyOffersIndex[_bidder][hash].index;
        uint256 bid = NFTHashToBuyOffers[hash][htboIndex];
        uint256 htbohIndex = userToHashToBuyOfferHashesIndex[_bidder][hash]
            .index;

        //NFT transfer
        IERC721(_NFTContract).transferFrom(msg.sender, _bidder, _tokenId);

        emit BuyOfferAccepted(_bidder, _NFTContract, _tokenId, bid);

        delete NFTHashToBuyOffers[hash][htboIndex];
        delete userToBuyOfferHashes[_bidder][htbohIndex];
        delete userToHashToBuyOffersIndex[_bidder][hash];
        delete userToHashToBuyOfferHashesIndex[_bidder][hash];

        (bool success, ) = payable(msg.sender).call{value: msg.value}("");
        require(success, "Transfer failed.");
    }
}
