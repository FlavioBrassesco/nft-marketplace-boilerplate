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
    mapping(address => mapping(bytes32 => uint256))
        internal userToBuyOfferHashIndex;
    mapping(address => bytes32[]) internal userToBuyOfferHashes;

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
            uint256 htboIndex = userToBuyOfferHashIndex[msg.sender][hash];
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
        uint256 indexed itemId,
        uint256 indexed bid,
        address indexed bidder
    );

    event BuyOfferCancelled(
        uint256 indexed itemId,
        uint256 indexed bid,
        address indexed bidder,
        address bidCancelledBy
    );

    //need to think of a way for bidder to retrieve his funds after a day, and for owner to not accept after 1 days.
    function createBuyOffer(address _NFTContract, uint256 _tokenId)
        public
        payable
        nonReentrant
        onlyNotListed(_NFTContract, _tokenId)
        onlyNotBlockedItem(_NFTContract, _tokenId)
    {}

    function acceptBuyOffer(uint256 _itemId)
        public
        nonReentrant
        onlySeller(_itemId)
        onlyNotAuction(_itemId)
        onlyNotForSale(_itemId)
    {}

    function cancelBuyOffer(uint256 _itemId)
        public
        nonReentrant
        onlySeller(_itemId)
        onlyNotAuction(_itemId)
        onlyNotForSale(_itemId)
    {}
}
