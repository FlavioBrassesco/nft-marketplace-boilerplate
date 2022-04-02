pragma solidity 0.8.0;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UniswapService {
  //change to appropiate router
  address internal constant UNISWAP_V2_ROUTER =
    0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

  // change to appropiate wrapped erc20 token address
  address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  // pay with WETH (Ether mainnet), WMATIC (Polygon Mainnet), WBNB (BSC Mainnet)
  // e.g: WETH in DAI out
  function payWithEth(
    uint256 amountIn,
    uint256 amountOutMin,
    address tokenOut
  ) internal {
    address[] memory path = new address[](2);
    path[0] = WETH;
    path[1] = tokenOut;
    IUniswapV2Router01(UNISWAP_V2_ROUTER).swapExactETHForTokens{
      value: amountIn
    }(amountOutMin, path, address(this), block.timestamp);
  }

  // pay with ERC20 configured token. e.g: DAI (Ether mainnet), WETH(Polygon Mainnet), BUSD (BSC Mainnet)
  // e.g: DAI in WETH out
  function payWithERC20(
    uint256 amountIn,
    uint256 amountOutMin,
    address tokenIn
  ) internal {
    address[] memory path = new address[](2);
    path[0] = tokenIn;
    path[1] = WETH;
    IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
    IERC20(tokenIn).approve(UNISWAP_V2_ROUTER, amountIn);

    IUniswapV2Router01(UNISWAP_V2_ROUTER).swapExactTokensForETH(
      amountIn,
      amountOutMin,
      path,
      address(this),
      block.timestamp
    );
  }

  function swapERC20(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMin
  ) {
    address[] memory path = new address[](2);
    path[0] = tokenIn;
    path[1] = tokenOut;

    IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
    IERC20(tokenIn).approve(UNISWAP_V2_ROUTER, amountIn);
    IUniswapV2Router01(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      address(this),
      block.timestamp
    );
  }

  function getAmountsOutMin(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn
  ) public view returns (uint256) {
    address[] memory path;
    if (_tokenIn == WETH || _tokenOut == WETH) {
      path = new address[](2);
      path[0] = _tokenIn;
      path[1] = _tokenOut;
    } else {
      path = new address[](3);
      path[0] = _tokenIn;
      path[1] = WETH;
      path[2] = _tokenOut;
    }

    uint256[] memory amountOutMins = IUniswapV2Router01(UNISWAP_V2_ROUTER)
      .getAmountsOut(_amountIn, path);
    return amountOutMins[path.length - 1];
  }
}
