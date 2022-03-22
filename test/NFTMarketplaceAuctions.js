const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

const ADDR_0 = "0x0000000000000000000000000000000000000000";
// Hardcoded Gas price in Ganache
const GAS_PRICE = ethers.BigNumber.from("20000000000");

describe("NFTMarketplace", () => {
  // arrange functions
  const deployMarketplace = async (name) => {
    const NFTMarketplace = await ethers.getContractFactory(
      "NFTMarketplaceAuctions"
    );
    const nftmarketplace = await NFTMarketplace.deploy(name);
    await nftmarketplace.deployed();
    return nftmarketplace;
  };
  const deployMinter = async (name, symbol) => {
    const NFTMinter = await ethers.getContractFactory("NFTMinter");
    const nftminter = await NFTMinter.deploy(name, symbol);
    await nftminter.deployed();
    return nftminter;
  };
  const mint = async (nftminter, address, tokensQty) => {
    for (let i = 0; i < tokensQty; i++) {
      const tx = await nftminter.mint(address, `${i}`);
      tx.wait();
    }
  };
});
