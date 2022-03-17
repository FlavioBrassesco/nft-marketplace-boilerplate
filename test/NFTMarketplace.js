const { expect } = require("chai");
const { ethers } = require("hardhat");

const ADDR_0 = "0x0000000000000000000000000000000000000000";

describe("Ownable", () => {
  let nftmarketplace;
  before(async () => {
    const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    nftmarketplace = await NFTMarketplace.deploy();
    await nftmarketplace.deployed();
  });

  it("Should pass if owner is owner()", async () => {
    const [owner] = await ethers.getSigners();
    expect(await nftmarketplace.owner()).to.equal(await owner.getAddress());
  });

  it("Should pass if new owner is addr1", async () => {
    const [owner, addr1] = await ethers.getSigners();
    const transferOwnership = await nftmarketplace.transferOwnership(
      await addr1.getAddress()
    );
    transferOwnership.wait();
    expect(await nftmarketplace.owner()).to.equal(await addr1.getAddress());
  });

  it("Should revert if old owner tries to transfer ownership", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await expect(
      nftmarketplace.transferOwnership(await owner.getAddress())
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should pass if ownership is effectively renounced", async () => {
    const [owner, addr1] = await ethers.getSigners();
    const tx = await nftmarketplace.connect(addr1).renounceOwnership();
    tx.wait();
    expect(await nftmarketplace.owner()).to.equal(ADDR_0);
  });
});

describe("NFTMarketplace", function () {
  let nftmarketplace;
  before(async () => {
    const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    nftmarketplace = await NFTMarketplace.deploy();
    await nftmarketplace.deployed();
  });

  describe("ERC721Holder", function () {
    it("Should pass if IERC721Receiver is implemented", async () => {
      const [owner, addr1] = await ethers.getSigners();
      expect(
        await nftmarketplace.callStatic.onERC721Received(
          await owner.getAddress(),
          await addr1.getAddress(),
          0,
          "0xffffffff"
        )
      ).to.equal("0x150b7a02");
    });
  });

  describe("NFT Contracts Whitelist Management", () => {
    it("Should return true if addr1 address is succesfully whitelisted", async () => {
      const [owner, addr1] = await ethers.getSigners();

      const addWhitelistedNFTContract =
        await nftmarketplace.addWhitelistedNFTContract(
          await addr1.getAddress()
        );
      await addWhitelistedNFTContract.wait();

      expect(
        await nftmarketplace.isWhitelistedNFTContract(await addr1.getAddress())
      ).to.equal(true);
    });

    it("Should revert if calling addWhitelistedNFTContract and removeWhitelistedNFTContract from addr1", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      await expect(
        nftmarketplace
          .connect(addr1)
          .addWhitelistedNFTContract(await addr2.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        nftmarketplace
          .connect(addr1)
          .removeWhitelistedNFTContract(await addr1.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should return false if addr2 address is not whitelisted", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();
      expect(
        await nftmarketplace.isWhitelistedNFTContract(await addr2.getAddress())
      ).to.equal(false);
    });

    it("Should revert if whitelisting address 0", async () => {
      await expect(
        nftmarketplace.addWhitelistedNFTContract(ADDR_0)
      ).to.be.revertedWith("Can't add address(0)");
    });

    it("Should return false for address 0", async () => {
      expect(await nftmarketplace.isWhitelistedNFTContract(ADDR_0)).to.equal(
        false
      );
    });

    it("Should return false if addr1 address is succesfully removed from whitelist", async () => {
      const [owner, addr1] = await ethers.getSigners();

      const removeWhitelistedNFTContract =
        await nftmarketplace.removeWhitelistedNFTContract(
          await addr1.getAddress()
        );
      await removeWhitelistedNFTContract.wait();

      expect(
        await nftmarketplace.isWhitelistedNFTContract(await addr1.getAddress())
      ).to.equal(false);
    });
  });

  describe("NFT Contracts fee management", function () {
    it("Should revert if trying to set fee for address 0", async () => {
      await expect(nftmarketplace.setFee(ADDR_0, 1000)).to.be.revertedWith(
        "Can't set fee for address(0)"
      );
    });

    it("Should revert if trying to set fee higher than 5000", async () => {
      const [owner] = await ethers.getSigners();
      await expect(
        nftmarketplace.setFee(await owner.getAddress(), 5001)
      ).to.be.revertedWith("Can't set fee higher than 50.00%");
    });

    it("Should pass if fee succesfully setted", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const tx = await nftmarketplace.setFee(await addr1.getAddress(), 3000);
      tx.wait();
      expect(await nftmarketplace.getFee(await addr1.getAddress())).to.equal(
        3000
      );
    });

    it("Should revert if querying fee for address 0", async () => {
      await expect(nftmarketplace.getFee(ADDR_0)).to.be.revertedWith(
        "Can't get fee for address(0)"
      );
    });

    it("Should revert if calling functions with wrong parameters", async () => {
      const [owner] = await ethers.getSigners();
      await expect(nftmarketplace.setFee(await owner.getAddress(), NaN)).to.be
        .reverted;
      await expect(nftmarketplace.setFee(await owner.getAddress(), -1000)).to.be
        .reverted;
      await expect(nftmarketplace.setFee(await owner.getAddress(), undefined))
        .to.be.reverted;
      await expect(nftmarketplace.setFee(await owner.getAddress(), null)).to.be
        .reverted;
      await expect(nftmarketplace.setFee(await owner.getAddress(), Infinity)).to
        .be.reverted;
    });
  });

  describe("NFT Contracts floor price management", function () {
    it("Should revert if trying to set floor price for address 0", async () => {
      await expect(
        nftmarketplace.setFloorPrice(ADDR_0, 1000)
      ).to.be.revertedWith("Can't set floor price for address(0)");
    });

    it("Should revert if trying to set floor price to 0", async () => {
      const [owner] = await ethers.getSigners();
      await expect(
        nftmarketplace.setFloorPrice(await owner.getAddress(), 0)
      ).to.be.revertedWith("Floor price must be at least 1 wei");
    });

    it("Should pass if floor price is succesfully setted", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const tx = await nftmarketplace.setFloorPrice(
        await addr1.getAddress(),
        50000
      );
      tx.wait();
      expect(
        await nftmarketplace.getFloorPrice(await addr1.getAddress())
      ).to.equal(50000);
    });

    it("Should revert if querying floor price for address 0", async () => {
      await expect(nftmarketplace.getFloorPrice(ADDR_0)).to.be.revertedWith(
        "Can't get floor price for address(0)"
      );
    });

    it("Should revert if calling functions with wrong parameters", async () => {
      const [owner] = await ethers.getSigners();
      await expect(nftmarketplace.setFloorPrice(await owner.getAddress(), NaN))
        .to.be.reverted;
      await expect(
        nftmarketplace.setFloorPrice(await owner.getAddress(), -1000)
      ).to.be.reverted;
      await expect(
        nftmarketplace.setFloorPrice(await owner.getAddress(), undefined)
      ).to.be.reverted;
      await expect(nftmarketplace.setFloorPrice(await owner.getAddress(), null))
        .to.be.reverted;
      await expect(
        nftmarketplace.setFloorPrice(await owner.getAddress(), Infinity)
      ).to.be.reverted;
    });
  });
});
