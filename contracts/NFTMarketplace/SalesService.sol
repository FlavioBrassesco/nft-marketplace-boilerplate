pragma solidity 0.8.0;

import "../UniswapService.sol";

contract SalesService is UniswapService {
  mapping(address => uint256) internal _userPendingRevenue;

  uint256 internal _pendingRevenue;

  mapping(address => bool) internal _approvedTokens;

  // set if you want the market to work in erc20. _balance, _pendingRevenue, _userPendingRevenue will work as erc20 if setted
  address internal constant ERC20CURRENCY = address(0);
  uint256 internal _balance;

  function _setApprovedTokenStatus(address erc20Address_, bool status_)
    internal
  {
    _approvedTokens[erc20Address_] = status_;
  }

  function buyWithERC20(
    address contractAddress_,
    uint256 tokenId_,
    address erc20Address_,
    uint256 amountIn_
  ) public payable nonReentrant whenNotPaused {
    require(
      _approvedTokens[erc20Address_],
      "Token not available for purchases"
    );
    uint256 amountsOutMin = getAmountsOutMin(erc20Address_, WETH, amountIn_);

    require(
      amountsOutMin <= _marketItems[contractAddress_][tokenId_].price,
      ""
    );

    // Payment & fee calculation
    uint256 paymentToSeller = amountIn_ -
      _calculateFee(amountIn_, contractAddress_);
    _userPendingRevenue[
      _marketItems[contractAddress_][tokenId_].seller
    ] += paymentToSeller;

    if (ERC20CURRENCY != address(0)) {
      if (erc20Address_ == ERC20CURRENCY) {
        SafeERC20(ERC20CURRENCY).safeTransferFrom(
          _msgSender(),
          address(this),
          amountIn_
        );
      } else {
        swapERC20(amountIn_, amountsOutMin, erc20Address_, ERC20CURRENCY);
      }
    } else {
      payWithERC20(amountIn_, amountsOutMin, erc20Address_);
    }

    _sellItem(_msgSender(), contractAddress_, tokenId_);
  }

  function buy(address contractAddress_, uint256 tokenId_) public payable {
    buy(address(0), contractAddress_, tokenId_);
  }

  /// @notice Buy a listed in marketplace item.
  function buy(
    address buyer_,
    address contractAddress_,
    uint256 tokenId_
  ) public payable nonReentrant whenNotPaused {
    // if item not listed, we try and execute a sell of an NFT from market owner
    if (_marketItems[contractAddress_][tokenId_].seller == address(0)) {
      // if not called by owner, caller pays with eth
      if (_msgSender() != owner()) {
        require(
          msg.value ==
            INFTCollectionManager(_collectionManager).getFloorPrice(
              contractAddress_
            ),
          "Floor price must be > 0"
        );
        _sellMarketOwnerItem(_msgSender(), contractAddress_, tokenId_);
      } else {
        // if called by owner, caller payed with credit card
        _sellMarketOwnerItem(buyer_, contractAddress_, tokenId_);
      }
    } else {
      require(
        msg.value == _marketItems[contractAddress_][tokenId_].price,
        "msg.value is not == Asking price"
      );
      // Payment & fee calculation
      uint256 paymentToSeller = msg.value -
        _calculateFee(msg.value, contractAddress_);
      _userPendingRevenue[
        _marketItems[contractAddress_][tokenId_].seller
      ] += paymentToSeller;
      _pendingRevenue += paymentToSeller;
      _sellItem(_msgSender(), contractAddress_, tokenId_);
    }
  }

  /// @notice Retrieve payed secondary sales fees.
  function transferSalesFees() public onlyOwner {
    if (ERC20CURRENCY == address(0)) {
      Address.sendValue(
        payable(owner()),
        address(this).balance - _pendingRevenue
      );
    } else {
      SafeERC20(ERC20CURRENCY).safeTransfer(owner(), _balance);
    }
  }

  function retrievePendingRevenue() public nonReentrant {
    require(_userPendingRevenue[_msgSender()] != 0, "No pending revenue");
    uint256 payment = _userPendingRevenue[_msgSender()];
    _pendingRevenue -= _userPendingRevenue[_msgSender()];
    delete _userPendingRevenue[_msgSender()];

    if (ERC20CURRENCY == address(0)) {
      Address.sendValue(
        payable(_msgSender()),
        _userPendingRevenue[_msgSender()]
      );
    } else {
      SafeERC20(ERC20CURRENCY).safeTransfer(
        owner(),
        __userPendingRevenue[_msgSender()]
      );
    }
  }

  function getUserPendingRevenue(address user_)
    public
    view
    returns (uint256 revenue)
  {
    return _userPendingRevenue[user_];
  }
}
