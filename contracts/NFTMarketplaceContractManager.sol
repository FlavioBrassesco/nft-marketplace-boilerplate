//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract NFTMarketplaceContractManager is Ownable {
    // Contract Address Management
    mapping(address => bool) internal _isWhitelistedNFTContract;
    mapping(address => uint256) internal _NFTContractToFee;
    mapping(address => uint256) internal _NFTContractToFloorPrice;

    address internal _externalManager;

    /// @notice Set contract manager as external contract.
    /// @dev This is to join storage state in case is needed for NFTMarketplace, Auctions and BuyOffers
    function setExternalManager(address contractAddress_) public onlyOwner {
        require(
            Address.isContract(contractAddress_),
            "NFTMarketplaceContractManager: Address is not a contract"
        );
        _externalManager = contractAddress_;
    }

    /// @notice Adds an NFT Contract address to the marketplace allowed contracts
    /// @param contractAddress_ address of NFT Collection
    function setWhitelistedNFTContract(address contractAddress_, bool status_)
        public
        onlyOwner
    {
        if (_externalManager != address(0)) {
            NFTMarketplaceContractManager(_externalManager)
                .setWhitelistedNFTContract(contractAddress_, status_);
        } else {
            _setWhitelistedNFTContract(contractAddress_, status_);
        }
    }

    function _setWhitelistedNFTContract(address contractAddress_, bool status_)
        internal
    {
        require(contractAddress_ != address(0), "Can't set address(0)");
        require(
            Address.isContract(contractAddress_),
            "NFTMarketplaceContractManager: Address is not a contract"
        );
        require(
            IERC721(contractAddress_).supportsInterface(
                type(IERC721).interfaceId
            ),
            "Address is not IERC721 compliant"
        );
        _isWhitelistedNFTContract[contractAddress_] = status_;
    }

    /// @notice Returns whitelist status for specified NFT contract address
    function isWhitelistedNFTContract(address contractAddress_)
        public
        view
        returns (bool)
    {
        if (_externalManager != address(0)) {
            return
                NFTMarketplaceContractManager(_externalManager)
                    .isWhitelistedNFTContract(contractAddress_);
        }
        return _isWhitelistedNFTContract[contractAddress_];
    }

    modifier onlyWhitelistedContract(address contractAddress_) {
        require(
            isWhitelistedNFTContract(contractAddress_),
            "NFTMarketplaceContractManager: Contract is not whitelisted"
        );
        _;
    }

    /// @notice Set a secondary sales fee for an NFT collection.
    /// @param contractAddress_ address of NFT collection.
    /// @param fee_ secondary sales fee for contractAddress_.
    function setFee(address contractAddress_, uint256 fee_) public onlyOwner {
        if (_externalManager != address(0)) {
            NFTMarketplaceContractManager(_externalManager).setFee(
                contractAddress_,
                fee_
            );
        } else {
            _setFee(contractAddress_, fee_);
        }
    }

    function _setFee(address contractAddress_, uint256 fee_) internal {
        require(contractAddress_ != address(0), "Can't set fee for address(0)");
        require(
            Address.isContract(contractAddress_),
            "NFTMarketplaceContractManager: Address is not a contract"
        );
        // Edit this line to change the maximum fee.
        require(fee_ < 51, "Can't set fee higher than 50.00%");
        _NFTContractToFee[contractAddress_] = fee_;
    }

    /// @notice Returns the secondary sales fee for the specified NFT collection.
    /// @param contractAddress_ address of NFT collection
    /// @return uint256 secondary sales fee.
    function getFee(address contractAddress_) public view returns (uint256) {
        if (_externalManager != address(0)) {
            return
                NFTMarketplaceContractManager(_externalManager).getFee(
                    contractAddress_
                );
        }
        return _NFTContractToFee[contractAddress_];
    }

    /// @notice Set floor price in wei for an NFT collection.
    /// @dev This floor price is only used in createMarketOwnerSale
    /// @param contractAddress_ address of NFT collection
    /// @param floorPrice_ floor price for contractAddress_ in wei
    function setFloorPrice(address contractAddress_, uint256 floorPrice_)
        public
        onlyOwner
    {
        if (_externalManager != address(0)) {
            NFTMarketplaceContractManager(_externalManager).setFloorPrice(
                contractAddress_,
                floorPrice_
            );
        } else {
            _setFloorPrice(contractAddress_, floorPrice_);
        }
    }

    function _setFloorPrice(address contractAddress_, uint256 floorPrice_)
        internal
    {
        require(
            contractAddress_ != address(0),
            "Can't set floor price for address(0)"
        );
        require(
            Address.isContract(contractAddress_),
            "NFTMarketplaceContractManager: Address is not a contract"
        );
        require(floorPrice_ > 0, "Floor price must be at least 1 wei");
        _NFTContractToFloorPrice[contractAddress_] = floorPrice_;
    }

    /// @notice Returns the floor price for the specified NFT collection
    /// @param contractAddress_ address of NFT collection
    /// @return uint256 floor price for contractAddress_ in wei
    function getFloorPrice(address contractAddress_)
        public
        view
        returns (uint256)
    {
        if (_externalManager != address(0)) {
            return
                NFTMarketplaceContractManager(contractAddress_).getFloorPrice(
                    contractAddress_
                );
        }
        return _NFTContractToFloorPrice[contractAddress_];
    }
}
