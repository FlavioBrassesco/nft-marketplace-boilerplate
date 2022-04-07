//SPDX-License-Identifier: GNU GPLv3 
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./interfaces/INFTCollectionManager.sol";
import "./interfaces/ISalesService.sol";

/// @title A simple NFT marketplace for collection owners.
/// @author Flavio Brassesco
/// @notice Users can use this marketplace to sell NFTs (ERC721) that are part of collections developed by or allowed by the marketplace owner.
contract NFTMarketplace is
    ReentrancyGuard,
    Ownable,
    ERC2771Context,
    ERC721Holder,
    Pausable
{
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
    INFTCollectionManager internal CollectionManager;
    ISalesService internal SalesService;
    address internal _trustedForwarder;

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

    constructor(address collectionManager_, address salesService_, address trustedForwarder_)
        ERC2771Context(trustedForwarder_)
    {
        CollectionManager = INFTCollectionManager(collectionManager_);
        SalesService = ISalesService(salesService_);
        _trustedForwarder = trustedForwarder_;
    }

    function buy(
        address contractAddress_,
        uint256 tokenId_,
        address tokenAddress_,
        uint256 amountIn_
    ) public payable nonReentrant whenNotPaused {
        bool marketOwner = false;
        address seller = _marketItems[contractAddress_][tokenId_].seller;
        uint256 price;
        uint256 feePercentage;

        // If item is not for sale we try to sell an item from market owner address.
        // This is useful for market owners that already have minted a batch of NFTs to sell,
        // instead of doing a pay-to-mint sale
        if (seller == address(0)) {
            seller = owner();
            price = CollectionManager.getFloorPrice(
                contractAddress_
            );
            feePercentage = 0;
            marketOwner = true;
        } else {
            price = _marketItems[contractAddress_][tokenId_].price;
            feePercentage = CollectionManager.getFee(
                contractAddress_
            );
        }

        emit MarketItemTransferred(
            seller,
            _msgSender(),
            contractAddress_,
            tokenId_,
            price
        );

        if (msg.value > 0) {
            SalesService.approvePayment{value: msg.value}(seller, price, feePercentage);
        } else {
            SalesService.approvePaymentERC20(
                _msgSender(),
                seller,
                tokenAddress_,
                amountIn_,
                price,
                feePercentage
            );
        }
        _sellItem(_msgSender(), contractAddress_, tokenId_, marketOwner);
    }

    function createMarketItem(
        address contractAddress_,
        uint256 tokenId_,
        uint256 price_
    ) public nonReentrant whenNotPaused {
        onlyWhitelisted(contractAddress_);
        require(price_ > 0, "Price must be at least 1 wei");

        _addMarketItem(_msgSender(), contractAddress_, tokenId_, price_);

        emit MarketItemCreated(
            _msgSender(),
            contractAddress_,
            tokenId_,
            price_
        );
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

        emit MarketItemUpdated(
            _msgSender(),
            contractAddress_,
            tokenId_,
            price_
        );
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

    function _sellItem(
        address to_,
        address contractAddress_,
        uint256 tokenId_,
        bool isMarketOwner
    ) internal {
        address from = address(this);

        if (isMarketOwner) {
            from = owner();
        } else {
            _destroyMarketItem(
                _marketItems[contractAddress_][tokenId_].seller,
                contractAddress_,
                tokenId_
            );
        }

        // NFT transfer
        IERC721(contractAddress_).safeTransferFrom(from, to_, tokenId_);
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

    function onlySeller(address contractAddress_, uint256 tokenId_)
        internal
        view
    {
        require(
            _msgSender() == _marketItems[contractAddress_][tokenId_].seller,
            "Only seller allowed"
        );
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
