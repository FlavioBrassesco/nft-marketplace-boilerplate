const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Greeter", function () {
  before(() => {
    const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    const nftmarketplace = await NFTMarketplace.deploy();
    await nftmarketplace.deployed();
  });

  it("Should return an array with all the added contracts", async function () {
    expect(await nftmarketplace.getAvailableNFTContracts()).to.deep.equal([]);

    const addAvailableNFTContract =
      await nftmarketplace.addAvailableNFTContract();

    // wait until the transaction is mined
    await addAvailableNFTContract.wait();

    expect(await nftmarketplace.getAvailableNFTContracts()).to.deep.equal([
      "0x00sdsads",
    ]);
  });
});
