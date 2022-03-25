const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployManager, deployMinter } = require("./helpers");

const ADDR_0 = "0x0000000000000000000000000000000000000000";

describe("NFT Contracts Whitelist Management", () => {
  let nftcontractmanager;
  let nftminter;
  beforeEach(async () => {
    nftcontractmanager = await deployManager();
    nftminter = await deployMinter("NFTMinter", "NM1", "", "", 10000, 10000);
  });

  it("Should return true if nftminter address is succesfully whitelisted", async () => {
    const addWhitelistedNFTContract =
      await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
    await addWhitelistedNFTContract.wait();

    expect(
      await nftcontractmanager.isWhitelistedNFTContract(nftminter.address)
    ).to.equal(true);
  });

  it("Should revert if calling setWhitelistedNFTContract from addr1", async () => {
    const [owner, addr1] = await ethers.getSigners();

    await expect(
      nftcontractmanager
        .connect(addr1)
        .setWhitelistedNFTContract(nftminter.address, true)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should return false if nftminter address is not whitelisted", async () => {
    expect(
      await nftcontractmanager.isWhitelistedNFTContract(nftminter.address)
    ).to.equal(false);
  });

  it("Should revert if whitelisting address 0", async () => {
    await expect(
      nftcontractmanager.setWhitelistedNFTContract(ADDR_0, true)
    ).to.be.revertedWith("Can't set address(0)");
  });

  it("Should return false for address 0", async () => {
    expect(await nftcontractmanager.isWhitelistedNFTContract(ADDR_0)).to.equal(
      false
    );
  });

  it("Should return false if nftminter address is succesfully removed from whitelist", async () => {
    const tx = await nftcontractmanager.setWhitelistedNFTContract(
      nftminter.address,
      false
    );
    await tx.wait();

    expect(
      await nftcontractmanager.isWhitelistedNFTContract(nftminter.address)
    ).to.equal(false);
  });
});

describe("NFT Contracts fee management", function () {
  let nftcontractmanager;
  before(async () => {
    nftcontractmanager = await deployManager();
  });

  it("Should revert if trying to set fee for address 0", async () => {
    await expect(nftcontractmanager.setFee(ADDR_0, 10)).to.be.revertedWith(
      "Can't set fee for address(0)"
    );
  });

  it("Should revert if trying to set fee higher than 5000", async () => {
    // arrange
    const [owner] = await ethers.getSigners();
    // act and assert
    await expect(
      nftcontractmanager.setFee(owner.address, 51)
    ).to.be.revertedWith("Can't set fee higher than 50.00%");
  });

  it("Should pass if fee succesfully setted", async () => {
    // arrange
    const [owner, addr1] = await ethers.getSigners();
    // act
    const tx = await nftcontractmanager.setFee(addr1.address, 30);
    tx.wait();
    // assert
    expect(await nftcontractmanager.getFee(addr1.address)).to.equal(30);
  });

  it("Should revert if querying fee for address 0", async () => {
    await expect(nftcontractmanager.getFee(ADDR_0)).to.be.revertedWith(
      "Can't get fee for address(0)"
    );
  });

  it("Should revert if calling functions with wrong parameters", async () => {
    const [owner] = await ethers.getSigners();
    await expect(nftcontractmanager.setFee(owner.address, NaN)).to.be.reverted;
    await expect(nftcontractmanager.setFee(owner.address, -1000)).to.be
      .reverted;
    await expect(nftcontractmanager.setFee(owner.address, Infinity)).to.be
      .reverted;
  });
});

describe("NFT Contracts floor price management", function () {
  let nftcontractmanager;
  before(async () => {
    nftcontractmanager = await deployManager();
  });

  it("Should revert if trying to set floor price for address 0", async () => {
    await expect(
      nftcontractmanager.setFloorPrice(ADDR_0, 1000)
    ).to.be.revertedWith("Can't set floor price for address(0)");
  });

  it("Should revert if trying to set floor price to 0", async () => {
    const [owner] = await ethers.getSigners();
    await expect(
      nftcontractmanager.setFloorPrice(owner.address, 0)
    ).to.be.revertedWith("Floor price must be at least 1 wei");
  });

  it("Should pass if floor price is succesfully setted", async () => {
    // arrange
    const [owner, addr1] = await ethers.getSigners();
    // act
    const tx = await nftcontractmanager.setFloorPrice(addr1.address, 50000);
    tx.wait();
    // assert
    expect(await nftcontractmanager.getFloorPrice(addr1.address)).to.equal(
      50000
    );
  });

  it("Should revert if querying floor price for address 0", async () => {
    await expect(nftcontractmanager.getFloorPrice(ADDR_0)).to.be.revertedWith(
      "Can't get floor price for address(0)"
    );
  });

  it("Should revert if calling functions with wrong parameters", async () => {
    const [owner] = await ethers.getSigners();
    await expect(nftcontractmanager.setFloorPrice(owner.address, NaN)).to.be
      .reverted;
    await expect(nftcontractmanager.setFloorPrice(owner.address, -1000)).to.be
      .reverted;
    await expect(nftcontractmanager.setFloorPrice(owner.address, Infinity)).to
      .be.reverted;
  });
});
