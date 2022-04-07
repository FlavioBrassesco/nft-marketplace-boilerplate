//SPDX-License-Identifier: GNU GPLv3 
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/abdk/ABDKMathQuad.sol";
import "../interfaces/ISalesService.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";

contract SalesService is ISalesService, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet internal _approvedTokens;
    EnumerableSet.AddressSet internal _authorizedMarketplaces;
    mapping(address => uint256) internal _pendingRevenue;
    address payable internal _treasuryAddress;

    //change to appropiate router (Uniswap, Quickswap, Pancakeswap)
    address internal constant UNISWAP_V2_ROUTER =
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    // change to appropiate wrapped erc20 token address (WETH, WMATIC, WBNB, etc)
    address public constant override WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    // use SalesServiceERC20 to make your marketplace work in BASE_CURRENCY
    address public constant override BASE_CURRENCY = address(0);

    constructor(address payable treasuryAddress_) {
        require(
            treasuryAddress_ != address(0),
            "treasury address(0) is not allowed"
        );
        _treasuryAddress = treasuryAddress_;
    }

    function setAuthorizedMarketplace(address marketplaceAddress_)
        public
        onlyOwner
    {
        if (!_authorizedMarketplaces.contains(marketplaceAddress_))
            _authorizedMarketplaces.add(marketplaceAddress_);
    }

    function setTreasuryAddress(address payable treasuryAddress_)
        public
        onlyOwner
    {
        require(
            treasuryAddress_ != address(0),
            "treasury address(0) is not allowed"
        );
        _treasuryAddress = treasuryAddress_;
    }

    function removeAuthorizedMarketplace(address marketplaceAddress_)
        public
        onlyOwner
    {
        if (_authorizedMarketplaces.contains(marketplaceAddress_))
            _authorizedMarketplaces.remove(marketplaceAddress_);
    }

    function getAuthorizedMarketplaces()
        public
        view
        returns (address[] memory)
    {
        return _authorizedMarketplaces.values();
    }

    modifier onlyMarketplace() {
        require(
            _authorizedMarketplaces.contains(_msgSender()),
            "Sender not allowed"
        );
        _;
    }

    modifier onlyTreasury() {
        require(_msgSender() == _treasuryAddress, "Only treasury allowed");
        _;
    }

    function setApprovedToken(address tokenAddress_) public onlyOwner {
        if (!_approvedTokens.contains(tokenAddress_))
            _approvedTokens.add(tokenAddress_);
    }

    function removeApprovedToken(address tokenAddress_) public onlyOwner {
        if (!_approvedTokens.contains(tokenAddress_))
            _approvedTokens.remove(tokenAddress_);
    }

    function getApprovedTokens() public view returns (address[] memory) {
        return _approvedTokens.values();
    }

    function approvePaymentERC20(
        address from_,
        address to_,
        address tokenAddress_,
        uint256 amountIn_,
        uint256 price_,
        uint256 feePercentage_
    ) public override onlyMarketplace nonReentrant returns(uint256) {
        require(_approvedTokens.contains(tokenAddress_), "Token not allowed");
        uint256 amountsOutMin = getAmountsOutMin(
            tokenAddress_,
            WETH,
            amountIn_
        );

        require(price_ <= amountsOutMin, "Not enough funds");

        // if address(this) is the receiver, we lock the payment for later retrieval through _returnPayment(address,uint256)
        if (to_ != address(this)) {
            uint256 fee = _calculateFee(price_, feePercentage_);
            uint256 paymentToSeller = price_ - fee;

            _pendingRevenue[to_] += paymentToSeller;
            _pendingRevenue[_treasuryAddress] += fee;
        }

        address[] memory path = new address[](2);
        path[0] = tokenAddress_;
        path[1] = WETH;
        IERC20(tokenAddress_).transferFrom(from_, address(this), amountIn_);
        IERC20(tokenAddress_).approve(UNISWAP_V2_ROUTER, amountIn_);

        IUniswapV2Router01(UNISWAP_V2_ROUTER).swapExactTokensForETH(
            amountIn_,
            amountsOutMin,
            path,
            address(this),
            block.timestamp
        );
        return amountsOutMin;
    }

    function getAmountsOutMin(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) public view override returns (uint256) {
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

        uint256[] memory amountsOutMin = IUniswapV2Router01(UNISWAP_V2_ROUTER)
            .getAmountsOut(_amountIn, path);
        return amountsOutMin[path.length - 1];
    }

    function approvePayment(
        address to_,
        uint256 price_,
        uint256 feePercentage_
    ) public payable override onlyMarketplace nonReentrant returns(uint256) {
        require(price_ == msg.value, "Not enough funds");

        // if address(this) is the receiver, we lock the payment for later retrieval through _returnPayment(address,uint256)
        if (to_ != address(this)) {
            uint256 fee = _calculateFee(price_, feePercentage_);
            uint256 paymentToSeller = price_ - fee;

            _pendingRevenue[to_] += paymentToSeller;
            _pendingRevenue[_treasuryAddress] += fee;
        }
        return msg.value;
    }

    function _calculateFee(uint256 amount_, uint256 percentage_)
        internal
        pure
        returns (uint256)
    {
        uint256 fee = ABDKMathQuad.toUInt(
            ABDKMathQuad.div(
                ABDKMathQuad.mul(
                    ABDKMathQuad.fromUInt(percentage_),
                    ABDKMathQuad.fromUInt(amount_)
                ),
                ABDKMathQuad.fromUInt(100)
            )
        );
        return fee;
    }

    function retrievePendingRevenue() public override nonReentrant {
        require(_pendingRevenue[_msgSender()] > 0, "No pending revenue");
        uint256 pendingRevenue = _pendingRevenue[_msgSender()];
        delete _pendingRevenue[_msgSender()];

        Address.sendValue(payable(_msgSender()), pendingRevenue);
    }

    function unlockPendingRevenue(
        address to_,
        uint256 amount_,
        uint256 percentage
    ) public override onlyMarketplace nonReentrant {
        uint256 fee = _calculateFee(amount_, percentage);
        _pendingRevenue[to_] += amount_ - fee;
        _pendingRevenue[_treasuryAddress] += fee;
    }

    function getUserPendingRevenue(address user_)
        public
        view
        override
        returns (uint256 revenue)
    {
        return _pendingRevenue[user_];
    }
}
