const { expect } = require("chai");
const { ethers } = require("hardhat");

const BASE_URI = "https://ipfs.io/hash/";
const ADDR_0 = "0x0000000000000000000000000000000000000000";

describe("NFTMinter", function () {
  let nftminter;
  before(async () => {
    const NFTMinter = await ethers.getContractFactory("NFTMinter");
    nftminter = await NFTMinter.deploy("NFTMinter2", "NM2");
    await nftminter.deployed();
  });

  describe("metadata", () => {
    it("Should return contract name", async function () {
      expect(await nftminter.name()).to.equal("NFTMinter2");
    });
    it("Should return contract symbol", async function () {
      expect(await nftminter.symbol()).to.equal("NM2");
    });
    it("Should return contractURI", async function () {
      expect(await nftminter.contractURI()).to.equal(
        "https://ipfs.io/ipfs/Qmbph4yScYn5xbCk2dvfHThpEfH2L2JBhng5xEWgxNLiYp/collection-1/collection.json"
      );
    });
  });

  describe("minting", () => {
    it("Should pass if 10 tokens minted", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const addr1Address = await addr1.getAddress();
      for (let i = 0; i < 10; i++) {
        const tx = await nftminter.mint(addr1Address, `${i}`);
        tx.wait();
      }

      expect(await nftminter.balanceOf(addr1Address)).to.equal(10);
      expect(await nftminter.totalSupply()).to.equal(10);
    });

    it("Should revert if minter is not owner", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(
        nftminter.connect(addr1).mint(await addr1.getAddress(), "11")
      ).to.be.reverted;
    });

    it("Should pass if addr1 is owner of tokenId 0", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const addr1Address = await addr1.getAddress();
      expect(await nftminter.ownerOf(0)).to.equal(addr1Address);
    });

    it("Should pass if addr1 successfully transfers token 0", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();
      const addr1Address = await addr1.getAddress();
      const addr2Address = await addr2.getAddress();

      const tx = await nftminter
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](
          addr1Address,
          addr2Address,
          0
        );
      tx.wait();

      expect(await nftminter.ownerOf(0)).to.equal(addr2Address);
    });

    it("Should revert if owner tries to transfer a token from addr1", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(
        nftminter.transferFrom(
          await addr1.getAddress(),
          await owner.getAddress(),
          1
        )
      ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
    });

    it("Should revert if addr1 tries to transfer token 1 to address 0", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(
        nftminter
          .connect(addr1)
          .transferFrom(await addr1.getAddress(), ADDR_0, 1)
      ).to.be.revertedWith("ERC721: transfer to the zero address");
    });

    it("Should pass if addr1 is not owner of tokenId 0", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const addr1Address = await addr1.getAddress();
      const balance = await nftminter.balanceOf(addr1Address);

      let tokensOfOwner = [];

      for (let i = 0; i < balance; i++) {
        tokensOfOwner.push(
          await nftminter.tokenOfOwnerByIndex(addr1Address, i)
        );
      }
      tokensOfOwner = tokensOfOwner.map((t) => {
        return t.toString();
      });

      expect(tokensOfOwner).to.not.include("0");
      expect(await nftminter.balanceOf(addr1Address)).to.equal(9);
    });

    it("Should pass if URI for token 0 is correct", async () => {
      expect(await nftminter.tokenURI(0)).to.equal(`${BASE_URI}0`);
    });

    it("Should pass if addr2 is correctly approved to manage tokenId 5", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();
      const tx = await nftminter
        .connect(addr1)
        .approve(await addr2.getAddress(), 5);
      tx.wait();

      expect(await nftminter.getApproved(5)).to.equal(await addr2.getAddress());

      const tx2 = await nftminter
        .connect(addr2)
        .transferFrom(await addr1.getAddress(), await addr2.getAddress(), 5);
      tx2.wait();

      expect(await nftminter.ownerOf(5)).to.equal(await addr2.getAddress());

      expect(await nftminter.getApproved(5)).to.equal(ADDR_0);
    });

    it("Should revert if owner tries to approve addr1 token", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(
        nftminter.approve(await owner.getAddress(), 3)
      ).to.be.revertedWith(
        "ERC721: approve caller is not owner nor approved for all"
      );
    });

    it("Should revert if addr1 tries to approve addr1", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(
        nftminter.approve(await addr1.getAddress(), 3)
      ).to.be.revertedWith("ERC721: approval to current owner");
    });

    it("Should revert if trying to getApproved for inexistent tokenID", async () => {
      await expect(nftminter.getApproved(120)).to.be.revertedWith(
        "ERC721: approved query for nonexistent token"
      );
    });

    it("Should pass if owner is correctly approved to manage all tokens of addr1", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const tx = await nftminter
        .connect(addr1)
        .setApprovalForAll(await owner.getAddress(), true);
      tx.wait();

      expect(
        await nftminter.isApprovedForAll(
          await addr1.getAddress(),
          await owner.getAddress()
        )
      ).to.equal(true);

      const tx2 = await nftminter.transferFrom(
        await addr1.getAddress(),
        await owner.getAddress(),
        6
      );
      tx2.wait();

      expect(await nftminter.ownerOf(6)).to.equal(await owner.getAddress());
    });

    it("Should pass if all tokens get listed correctly", async () => {
      const [owner] = await ethers.getSigners();
      const totalSupply = await nftminter.totalSupply();

      let tokens = [];
      const check = [];

      for (let i = 0; i < totalSupply; i++) {
        tokens.push(await nftminter.tokenByIndex(i));
        check.push(i.toString());
      }
      tokens = tokens.map((t) => {
        return t.toString();
      });

      expect(tokens).to.have.members(check);
    });
  });
});
