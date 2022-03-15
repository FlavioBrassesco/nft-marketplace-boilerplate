// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @title ActiveIndexes
/// @author Flavio Brassesco
/// @dev Provides an index that can be set as active or inactive. Useful with meaningful zero values in mappings.
/// This is a saving gas alternative (~49%) to using two mappings, one for saving an index and other for a flag.
/// Beware that max index stored can be 2^255-1 not 2^256-1
library ActiveIndexes {
    struct ActiveIndex {
        uint256 _value; // default: 0
    }

    /// @dev Return current index
    function index(ActiveIndex storage activeIndex)
        internal
        view
        returns (uint256)
    {
        return activeIndex._value >> 1;
    }

    /// @dev Returns true if index is active
    function isActive(ActiveIndex storage activeIndex)
        internal
        view
        returns (bool)
    {
        uint8 mask = 0x01;
        if (uint8(activeIndex._value) & mask > 0) return true;
        return false;
    }

    /// @dev store index and activate it
    function storeIndex(ActiveIndex storage activeIndex, uint256 _index)
        internal
    {
        uint8 mask = 0x01;
        activeIndex._value = uint256(mask);
        activeIndex._value |= _index << 1;
    }

    /// @dev Activate index. Although this functionality is included I recommend using storeIndex() for activating and delete for deactivating.
    function activateIndex(ActiveIndex storage activeIndex) internal {
        uint8 mask = 0x01;
        activeIndex._value |= uint256(mask);
    }

    /// @dev Deactivate index. Although this functionality is included I recommend using storeIndex() for activating and delete for deactivating.
    function deactivateIndex(ActiveIndex storage activeIndex) internal {
        uint8 mask = 0xFE;
        uint8 lo8 = uint8(activeIndex._value);
        lo8 &= mask;
        activeIndex._value = activeIndex._value >> 8;
        activeIndex._value = activeIndex._value << 8;
        activeIndex._value |= uint256(lo8);
    }
}
