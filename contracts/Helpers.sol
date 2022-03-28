//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./libraries/abdk/ABDKMathQuad.sol";

library Helpers {
    /// @dev A cheap, gas efficient function to create a unique NFT ID joining address and token ID with a bitwise operation.
    /// this assumes that _tokenId is implemented as a number.
    /// If the marketplace is going to sell only one collection, this becomes useless and code should be refactored.
    /// @param contractAddress_ The address of the contract
    /// @param tokenId_ The ID of the token
    /// @return uint256 unique NFT ID.
    function makeNftId(address contractAddress_, uint32 tokenId_)
        public
        pure
        returns (uint256)
    {
        return
            uint256(0) | uint160(contractAddress_) | (uint256(tokenId_) << 160);
    }

    /// @dev Used to get accurate percentage of a uint
    /// source: https://medium.com/coinmonks/math-in-solidity-part-3-percents-and-proportions-4db014e080b1
    function _mulDiv(
        uint256 x_,
        uint256 y_,
        uint256 z_
    ) internal pure returns (uint256) {
        return
            ABDKMathQuad.toUInt(
                ABDKMathQuad.div(
                    ABDKMathQuad.mul(
                        ABDKMathQuad.fromUInt(x_),
                        ABDKMathQuad.fromUInt(y_)
                    ),
                    ABDKMathQuad.fromUInt(z_)
                )
            );
    }
}
