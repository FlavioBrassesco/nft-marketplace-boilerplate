//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NFTMarketplaceHelpers {
    /// @dev A cheap, gas efficient function to create a unique NFT ID joining address and token ID with a bitwise operation.
    /// this assumes that _tokenId is implemented as a number.
    /// If the marketplace is going to sell only one collection, this becomes useless and code should be refactored.
    /// @param contractAddress_ The address of the contract
    /// @param tokenId_ The ID of the token
    /// @return uint256 unique NFT ID.
    function _makeNftId(address contractAddress_, uint32 tokenId_)
        public
        pure
        returns (uint256)
    {
        return
            uint256(0) | uint160(contractAddress_) | (uint256(tokenId_) << 160);
    }

    /// @dev function should be called from a nonReentrant public function
    function _safeTransferValue(address to_, uint256 value_) internal {
        uint256 balance = address(this).balance;
        (bool success, ) = to_.call{value: value_}("");
        require(success, "Transfer failed.");
        assert(address(this).balance == balance - value_);
    }
}
