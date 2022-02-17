//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFTMarketplaceAuctions.sol";

/**
@dev adds support for unsolicited buy offer
User can post an offer anytime and cancel anytime
Owner can accept offer anytime as long as the offer is there
Offers are stored in a pool and refunded when cancelled or item sold (if not winners)
Marketplace Item is created if it does not exist when is sold.
Not possible to place buy offer for auction items
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

  event BuyOfferCreated(
    uint256 indexed itemId,
    uint256 indexed currentBid,
    address indexed currentBidder
  );

  event BuyOfferCancelled(
    uint256 indexed itemId,
    uint256 indexed currentBid,
    address indexed currentBidder,
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
  {
    emit MarketItemSold(
      _itemId,
      idToMarketItem[_itemId].tokenId,
      idToAuctionItem[_itemId].currentBid,
      idToMarketItem[_itemId].nftContract,
      idToMarketItem[_itemId].seller,
      idToAuctionItem[_itemId].currentBidder
    );
  }

  function cancelBuyOffer(uint256 _itemId)
    public
    nonReentrant
    onlySeller(_itemId)
    onlyNotAuction(_itemId)
    onlyNotForSale(_itemId)
  {
    emit BuyOfferCancelled(
      _itemId,
      idToAuctionItem[_itemId].currentBid,
      idToAuctionItem[_itemId].currentBidder,
      payable(msg.sender)
    );
  }
}
