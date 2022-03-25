const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const {
  deployMinter,
  mint,
  deployManager,
  deployMarketplaceBuyOffers,
} = require("./helpers");

const ADDR_0 = "0x0000000000000000000000000000000000000000";
// Hardcoded Gas price in Ganache
const GAS_PRICE = ethers.BigNumber.from("20000000000");
const MAX_DAYS = 7;
const MAX_SUPPLY = 1000;
const FLOOR_PRICE = 100000000000;

describe("NFTMarketplaceBuyOffers", () => {
  let nftmarketplace;
  let nftcontractmanager;
  let nftminter;
  beforeEach(async () => {
    nftcontractmanager = await deployManager();
    nftmarketplace = await deployMarketplaceBuyOffers(
      "NFTMarketplaceBuyOffers",
      nftcontractmanager.address,
      MAX_DAYS
    );
    nftminter = await deployMinter(
      "NFTMinter",
      "NM1",
      "",
      "",
      MAX_SUPPLY,
      FLOOR_PRICE
    );
  });

  describe("createBuyOffer", () => {
    it("Should revert if offer is 0", async () => {});
    it("Should revert if addr2 already has an offer for addr1 item", async () => {});
    it("Should pass if addr2 successfully creates a buy offer for addr1 item", async () => {});
  });
  describe("cancelBuyOffer", () => {
    it("Should revert if addr2 has no active offer for addr1 item to cancel", async () => {});
    it("Should pass if addr2 successfully cancels a buy offer for addr1 item", async () => {});
  });
  describe("acceptBuyOffer", () => {
    it("Should revert if offer is 0", async () => {});
    it("Should pass if addr1 successfully accepts addr2 buy offer", async () => {});
  });
  describe("transferSalesFees", () => {
    it("Should revert if transferSalesFees is not called by owner", async () => {
      const [, addr1] = await ethers.getSigners();
      await expect(
        nftmarketplace.connect(addr1).transferSalesFees()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should revert if owner tries to call transferSalesFees but there are no sales fees to transfer", async () => {
      const [, addr1, addr2] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 2);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets fee
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      const options = { value: 100000 };
      // addr2 creates Buy Offer
      const txCreateBuyOffer = await nftmarketplace
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, options);
      txCreateBuyOffer.wait();

      await expect(nftmarketplace.transferSalesFees()).to.be.revertedWith(
        "No sales fees to retrieve"
      );
    });
    it("Should pass if sales fees are successfully transferred to owner", async () => {});
  });
  describe("BuyOffer Enumeration", () => {
    it("Should pass if all buy offers of addr1 are ok", async () => {});
    it("Should pass if all buy offers of token 0 are ok", async () => {});
    it("Should pass if all buy offers are ok", async () => {});
  });
});
