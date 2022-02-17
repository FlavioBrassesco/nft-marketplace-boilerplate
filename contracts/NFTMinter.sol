//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./ERC721URIStorage.sol";
import "./ContextMixin.sol";
import "./NativeMetaTransaction.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NFTMinter is
  ERC721URIStorage,
  ContextMixin,
  NativeMetaTransaction,
  Ownable
{
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;

  constructor(string memory _name, string memory _symbol)
    ERC721(_name, _symbol)
  {
    _initializeEIP712(_name);
  }

  /**
   @return metadata URI for opensea collection.
   @dev be sure to replace return string to correct URI
   **/
  function contractURI() public pure returns (string memory) {
    return
      "https://ipfs.io/ipfs/Qmbph4yScYn5xbCk2dvfHThpEfH2L2JBhng5xEWgxNLiYp/collection-1/collection.json";
  }

  /**
   * This is used instead of msg.sender so transactions could be sent by the original token owner and by OpenSea.
   */
  function _msgSender() internal view override returns (address sender) {
    return ContextMixin.msgSender();
  }

  /**
   * Override isApprovedForAll to whitelist OpenSea proxy accounts on Matic
   */
  function isApprovedForAll(address _owner, address _operator)
    public
    view
    override
    returns (bool isOperator)
  {
    if (_operator == address(0x58807baD0B376efc12F5AD86aAc70E78ed67deaE)) {
      return true;
    }

    return ERC721.isApprovedForAll(_owner, _operator);
  }

  /**
   @param _to address to be the owner of minted NFT
   @param _tokenURI associated metadata URI of minted NFT
   @dev public function to mint NFTs with associated metadata URI
   **/
  function mintItem(address _to, string memory _tokenURI)
    public
    onlyOwner
    returns (uint256)
  {
    _tokenIds.increment();
    uint256 newItemId = _tokenIds.current();
    _mint(_to, newItemId);
    _setTokenURI(newItemId, _tokenURI);
    return newItemId;
  }

  /**
   @param _address address to look for owned NFTs
   @param _cursor uint256 lower limit to be used as pagination
   @param _limit uint256 quantity of items to be returned
   @param _balance uint256 number of remaining NFTs to be fetched. Defaults to balanceOf(_address)
   @dev public view function to fetch NFTs by owner, with pagination.
   This could be implemented also in the front-end by calling tokenOfOwnerByIndex inside a loop.
   I think there could be some performance gain by running it on-chain being careful to not exceed
   block gas limit. This has yet to be tested.
   This has to be paired with cache functionality in the app. Maybe running this the first time and
   subscribe to transfer events while logged in. Then depending on how much time has passed since
   last log-in use the event logs or run this again.
   **/
  function fetchOwnedNFTs(
    address _address,
    uint256 _cursor,
    uint256 _limit,
    uint256 _balance
  ) public view returns (uint256[] memory) {
    require(
      _balance > 0,
      "Error: This address doesn't own any NFT or all NFT have been already fetched"
    );
    uint256[] memory result = new uint256[](_balance);
    uint256 counter = 0;
    uint256 totalNFTSupply = totalSupply();
    uint256 limit = (_limit + _cursor) > totalNFTSupply
      ? totalNFTSupply
      : (_limit + _cursor);
    require(_cursor < totalNFTSupply, "Error: Cursor out of Bounds");
    require(limit > _cursor, "Error: limit must be > cursor");
    for (uint256 i = _cursor; i < limit; i++) {
      uint256 tokenId = tokenOfOwnerByIndex(_address, i);
      if (tokenId != 0) {
        result[counter] = tokenId;
        counter++;
      }
      // if we already have fetched all of this address NFTs then skip the rest and save some computation
      if (counter == _balance) break;
    }
    return result;
  }

  /**
   @dev function overloading to allow fetchOwnedNFTs to be called without _balance parameter
   **/
  function fetchOwnedNFTs(
    address _address,
    uint256 _cursor,
    uint256 _limit
  ) public view returns (uint256[] memory) {
    uint256 balance = balanceOf(_address);
    return fetchOwnedNFTs(_address, _cursor, _limit, balance);
  }
}
