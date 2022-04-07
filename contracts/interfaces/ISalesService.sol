//SPDX-License-Identifier: GNU GPLv3 
pragma solidity 0.8.0;

interface ISalesService {

    function WETH() external  returns (address) ;
    function BASE_CURRENCY() external returns(address);

    function approvePaymentERC20(
        address from_,
        address to_,
        address tokenAddress_,
        uint256 amountIn_,
        uint256 price_,
        uint256 feePercentage_
    ) external returns(uint256);

    function approvePayment(
        address to_,
        uint256 price_,
        uint256 feePercentage_
    ) external payable returns(uint256);

    function retrievePendingRevenue() external;

    function unlockPendingRevenue(
        address to_,
        uint256 amount_,
        uint256 fee
    ) external;

    function getUserPendingRevenue(address user_)
        external
        view
        returns (uint256 revenue);

    function getAmountsOutMin(address,address,uint256) external view returns (uint256);
}
