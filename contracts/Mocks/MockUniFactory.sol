pragma solidity =0.5.16;

import "@uniswap/v2-core/contracts/UniswapV2Factory.sol";

contract MockUniFactory is UniswapV2Factory {
  constructor(address feeToSetter_) public UniswapV2Factory(feeToSetter_) {}

  function receive() external payable {}
  function fallback() external payable {}
}
