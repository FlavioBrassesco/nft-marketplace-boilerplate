//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./libraries/abdk/ABDKMathQuad.sol";

library Helpers {
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

    /// @dev Gets revert msg from a low level call returnData
    /// source: https://ethereum.stackexchange.com/questions/83528/how-can-i-get-the-revert-reason-of-a-call-in-solidity-so-that-i-can-use-it-in-th
    function _getRevertMsg(bytes memory _returnData)
        internal
        pure
        returns (string memory)
    {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }
}
