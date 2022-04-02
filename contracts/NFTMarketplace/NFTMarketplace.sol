//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./libraries/abdk/ABDKMathQuad.sol";
import "./INFTCollectionManager.sol";
import "./UniswapService.sol";

/// @title A simple NFT marketplace for collection owners.
/// @author Flavio Brassesco
/// @notice Users can use this marketplace to sell NFTs (ERC721) that are part of collections developed by the marketplace owner.
contract NFTMarketplace is
  ReentrancyGuard,
  Ownable,
  ERC721Holder,
  Pausable,
  ERC2771Context,
  UniswapService
{
  using Counters for Counters.Counter;
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;

  mapping(address => mapping(uint256 => MarketItem)) internal _marketItems;
  mapping(address => mapping(address => EnumerableSet.UintSet))
    internal _userTokenIds;
  mapping(address => EnumerableSet.UintSet) internal _collectionTokenIds;

  struct MarketItem {
    address seller;
    uint256 price;
  }

  string private _name;
  address internal _collectionManager;

  event MarketItemCreated(
    address indexed seller,
    address indexed contractAddress,
    uint256 indexed tokenId,
    uint256 price
  );

  event MarketItemUpdated(
    address indexed seller,
    address indexed contractAddress,
    uint256 indexed tokenId,
    uint256 price
  );

  event MarketItemTransferred(
    address indexed seller,
    address owner,
    address indexed contractAddress,
    uint256 indexed tokenId,
    uint256 price
  );

  constructor(address collectionManager_, address trustedForwarder_)
    ERC2771Context(trustedForwarder_)
  {
    _collectionManager = collectionManager_;
  }

  function createMarketItem(
    address contractAddress_,
    uint256 tokenId_,
    uint256 price_
  ) public nonReentrant whenNotPaused {
    onlyWhitelisted(contractAddress_);
    require(price_ > 0, "Price must be at least 1 wei");

    _addMarketItem(_msgSender(), contractAddress_, tokenId_, price_);

    emit MarketItemCreated(_msgSender(), contractAddress_, tokenId_, price_);
    //NFT transfer from msg sender to this contract
    IERC721(contractAddress_).safeTransferFrom(
      _msgSender(),
      address(this),
      tokenId_
    );
  }

  function updateMarketItem(
    address contractAddress_,
    uint256 tokenId_,
    uint256 price_
  ) public {
    onlySeller(contractAddress_, tokenId_);
    require(price_ > 0, "Price must be at least 1 wei");
    _marketItems[contractAddress_][tokenId_].price = price_;

    emit MarketItemUpdated(_msgSender(), contractAddress_, tokenId_, price_);
  }

  /// @notice Cancels a listed item and returns NFT to seller.
  function cancelMarketItem(address contractAddress_, uint256 tokenId_)
    public
    nonReentrant
  {
    onlySeller(contractAddress_, tokenId_);
    emit MarketItemTransferred(
      _msgSender(),
      _msgSender(),
      contractAddress_,
      tokenId_,
      _marketItems[contractAddress_][tokenId_].price
    );
    _destroyMarketItem(_msgSender(), contractAddress_, tokenId_);

    IERC721(contractAddress_).safeTransferFrom(
      address(this),
      _msgSender(),
      tokenId_
    );
  }

  function itemOfUserByIndex(
    address user_,
    address contractAddress_,
    uint256 index_
  ) public view returns (MarketItem memory) {
    require(
      index_ < _userTokenIds[user_][contractAddress_].length(),
      "Index out of bounds"
    );
    uint256 tokenId = _userTokenIds[user_][contractAddress_].at(index_);
    return _marketItems[contractAddress_][tokenId];
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
    returns (MarketItem memory)
  {
    require(
      index_ < _collectionTokenIds[contractAddress_].length(),
      "Index out of bounds"
    );
    uint256 tokenId = _collectionTokenIds[contractAddress_].at(index_);
    return _marketItems[contractAddress_][tokenId];
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

  function _addMarketItem(
    address sender_,
    address contractAddress_,
    uint256 tokenId_,
    uint256 price_
  ) internal {
    _userTokenIds[sender_][contractAddress_].add(tokenId_);
    _collectionTokenIds[contractAddress_].add(tokenId_);
    _marketItems[contractAddress_][tokenId_] = MarketItem(sender_, price_);
  }

  function _destroyMarketItem(
    address sender_,
    address contractAddress_,
    uint256 tokenId_
  ) internal {
    _userTokenIds[sender_][contractAddress_].remove(tokenId_);
    _collectionTokenIds[contractAddress_].remove(tokenId_);
    delete _marketItems[contractAddress_][tokenId_];
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

  function _sellItem(
    address to_,
    address contractAddress_,
    uint256 tokenId_
  ) internal {
    onlyForSale(contractAddress_, tokenId_);
    onlyNotSeller(contractAddress_, tokenId_);
    emit MarketItemTransferred(
      _marketItems[contractAddress_][tokenId_].seller,
      to_,
      contractAddress_,
      tokenId_,
      _marketItems[contractAddress_][tokenId_].price
    );
    _destroyMarketItem(
      _marketItems[contractAddress_][tokenId_].seller,
      contractAddress_,
      tokenId_
    );
    // NFT transfer
    IERC721(contractAddress_).safeTransferFrom(address(this), to_, tokenId_);
  }

  function _sellMarketOwnerItem(
    address to_,
    address contractAddress_,
    uint256 tokenId_
  ) internal {
    onlyWhitelisted(contractAddress_);
    uint256 floorPrice = INFTCollectionManager(_collectionManager)
      .getFloorPrice(contractAddress_);
    require(floorPrice > 0, "Floor price must be at least 1 wei");
    require(msg.value == floorPrice, "Asking price must be == floorPrice");

    emit MarketItemTransferred(
      owner(),
      to_,
      contractAddress_,
      tokenId_,
      floorPrice
    );
    // NFT transfer
    IERC721(contractAddress_).safeTransferFrom(owner(), to_, tokenId_);
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

  function onlyForSale(address contractAddress_, uint256 tokenId_)
    internal
    view
  {
    require(
      _marketItems[contractAddress_][tokenId_].seller != address(0),
      "Item not for sale"
    );
  }

  function onlySeller(address contractAddress_, uint256 tokenId_)
    internal
    view
  {
    require(
      _msgSender() == _marketItems[contractAddress_][tokenId_].seller,
      "Only seller allowed"
    );
  }

  function onlyNotSeller(address contractAddress_, uint256 tokenId_)
    internal
    view
  {
    require(
      _msgSender() != _marketItems[contractAddress_][tokenId_].seller,
      "Seller not allowed"
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
