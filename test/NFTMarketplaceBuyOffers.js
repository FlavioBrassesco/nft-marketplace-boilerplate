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
    it("Should revert if panic switch activated", async () => {
      const [, addr1] = await ethers.getSigners();

      const txPanic = await nftmarketplace.setPanicSwitch(true);
      txPanic.wait();

      await expect(
        nftmarketplace
          .connect(addr1)
          .createBuyOffer(nftminter.address, 0, { value: 1000 })
      ).to.be.revertedWith("Something went wrong");
    });
    it("Should revert if offer is 0", async () => {
      const [, addr1] = await ethers.getSigners();

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      await expect(
        nftmarketplace.connect(addr1).createBuyOffer(nftminter.address, 0)
      ).to.be.revertedWith("Price must be at least 1 wei");
    });
    it("Should revert if addr2 already has an offer for addr1 item", async () => {
      const [, addr1] = await ethers.getSigners();

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 10000 };
      const txCBOffer = await nftmarketplace
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      await expect(
        nftmarketplace
          .connect(addr1)
          .createBuyOffer(nftminter.address, 0, options)
      ).to.be.revertedWith("You already have an offer for this item");
    });
    it("Should pass if addr1 successfully creates a buy offer for an item", async () => {
      const [, addr1] = await ethers.getSigners();

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 10000 };
      const txCBOffer = await nftmarketplace
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      expect(await nftmarketplace.getUserBidsCount(addr1.address)).to.equal(1);
      expect(
        (await nftmarketplace.bidOfUserByIndex(addr1.address, 0)).bid
      ).to.equal(options.value);
    });
    it("Should pass if two users successfully create a buy offer for same item", async () => {
      const [, addr1, addr2] = await ethers.getSigners();

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 10000 };
      const txCBOffer = await nftmarketplace
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      const options2 = { value: 12000 };
      const txCBOffer2 = await nftmarketplace
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, options2);
      txCBOffer2.wait();

      expect(await nftmarketplace.getUserBidsCount(addr1.address)).to.equal(1);
      expect(
        (await nftmarketplace.bidOfUserByIndex(addr1.address, 0)).bid
      ).to.equal(options.value);
      expect(await nftmarketplace.getUserBidsCount(addr2.address)).to.equal(1);
      expect(
        (await nftmarketplace.bidOfUserByIndex(addr2.address, 0)).bid
      ).to.equal(options2.value);
    });
  });
  describe("cancelBuyOffer", () => {
    it("Should revert if addr1 has no active offer for the specified item", async () => {
      const [, addr1] = await ethers.getSigners();
      await expect(
        nftmarketplace.connect(addr1).cancelBuyOffer(nftminter.address, 0)
      ).to.be.revertedWith("No active offer found");
    });
    it("Should pass if addr2 successfully cancels a buy offer for addr1 item", async () => {
      const [, addr1] = await ethers.getSigners();

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 10000 };
      const txCBOffer = await nftmarketplace
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      expect(await nftmarketplace.getUserBidsCount(addr1.address)).to.equal(1);
      expect(
        (await nftmarketplace.bidOfUserByIndex(addr1.address, 0)).bid
      ).to.equal(options.value);

      const txCBCancel = await nftmarketplace
        .connect(addr1)
        .cancelBuyOffer(nftminter.address, 0);
      txCBCancel.wait();

      expect(await nftmarketplace.getUserBidsCount(addr1.address)).to.equal(0);
      await expect(
        nftmarketplace.bidOfUserByIndex(addr1.address, 0)
      ).to.be.revertedWith("User Bid index out of bounds");
    });
  });
  describe("acceptBuyOffer", () => {
    it("Should revert if offer is not found", async () => {
      const [, addr1, addr2] = await ethers.getSigners();
      await expect(
        nftmarketplace
          .connect(addr1)
          .acceptBuyOffer(nftminter.address, 0, addr2.address)
      ).to.be.revertedWith("No active offer found");
    });
    it("Should pass if addr1 successfully accepts addr2 buy offer", async () => {
      const [, addr1, addr2] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txSetApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txSetApproval.wait();

      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      const price = 10000;
      const fee =
        ((await nftcontractmanager.getFee(nftminter.address)) * price) / 100;
      const options = { value: price };
      const txCBOffer = await nftmarketplace
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      const addr1BalanceBefore = await waffle.provider.getBalance(
        addr1.address
      );

      const marketBalanceBefore = await waffle.provider.getBalance(
        nftmarketplace.address
      );

      const txAccept = await nftmarketplace
        .connect(addr1)
        .acceptBuyOffer(nftminter.address, 0, addr2.address);
      txAccept.wait();

      const gasUsed = (
        await waffle.provider.getTransactionReceipt(txAccept.hash)
      ).gasUsed;
      const gasFee = gasUsed.mul(GAS_PRICE);

      const addr1BalanceAfter = await waffle.provider.getBalance(addr1.address);

      const marketBalanceAfter = await waffle.provider.getBalance(
        nftmarketplace.address
      );

      expect(addr1BalanceAfter).to.be.equal(
        addr1BalanceBefore.sub(gasFee).add(price).sub(fee)
      );
      expect(marketBalanceAfter).to.be.equal(
        marketBalanceBefore.sub(price).add(fee)
      );
    });
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

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

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
    it("Should pass if sales fees are successfully transferred to owner", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txSetApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txSetApproval.wait();

      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      const marketBalanceBefore = await waffle.provider.getBalance(
        nftmarketplace.address
      );

      const price = 10000;
      const fee =
        ((await nftcontractmanager.getFee(nftminter.address)) * price) / 100;

      const options = { value: price };
      const txCBOffer = await nftmarketplace
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      const txAccept = await nftmarketplace
        .connect(addr1)
        .acceptBuyOffer(nftminter.address, 0, addr2.address);
      txAccept.wait();

      const ownerBalanceBefore = await waffle.provider.getBalance(
        owner.address
      );

      const txTransferSalesFees = await nftmarketplace.transferSalesFees();
      txTransferSalesFees.wait();

      const gasUsed = (
        await waffle.provider.getTransactionReceipt(txTransferSalesFees.hash)
      ).gasUsed;
      const gasFee = gasUsed.mul(GAS_PRICE);

      const ownerBalanceAfter = await waffle.provider.getBalance(owner.address);

      const marketBalanceAfter = await waffle.provider.getBalance(
        nftmarketplace.address
      );

      expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore.sub(gasFee).add(fee)
      );
      expect(marketBalanceAfter).to.equal(marketBalanceBefore);
    });
  });
  describe("BuyOffer Enumeration", () => {
    it("Should pass if all buy offers of addr1 are ok", async () => {
      const [, addr1] = await ethers.getSigners();
      const qty = 3;

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      for (let i = 0; i < qty; i++) {
        const txCBOffer = await nftmarketplace
          .connect(addr1)
          .createBuyOffer(nftminter.address, i, { value: 1000 + i });
        txCBOffer.wait();
      }

      const count = await nftmarketplace.getUserBidsCount(addr1.address);

      for (let i = 0; i < count; i++) {
        const nftId = await nftmarketplace._makeNftId(nftminter.address, i);
        const bid = await nftmarketplace.bidOfUserByIndex(addr1.address, i);

        expect(bid.bid).to.equal(1000 + i);
        expect(bid.nftId).to.equal(nftId);
      }
    });
    it("Should pass if all buy offers of token 0 are ok", async () => {
      const [, addr1, addr2, addr3] = await ethers.getSigners();

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txCBOffer = await nftmarketplace
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, { value: 1000 });
      txCBOffer.wait();
      const txCBOffer2 = await nftmarketplace
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, { value: 1000 + 1 });
      txCBOffer2.wait();
      const txCBOffer3 = await nftmarketplace
        .connect(addr3)
        .createBuyOffer(nftminter.address, 0, { value: 1000 + 2 });
      txCBOffer3.wait();

      const nftId = await nftmarketplace._makeNftId(nftminter.address, 0);
      const count = await nftmarketplace.getNftIdBidsCount(nftId);

      for (let i = 0; i < count; i++) {
        const bid = await nftmarketplace.bidOfNftIdByIndex(nftId, i);

        expect(bid).to.equal(1000 + i);
      }
    });
    it("Should pass if all buy offers are ok", async () => {
      const [, addr1] = await ethers.getSigners();
      const qty = 3;

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      for (let i = 0; i < qty; i++) {
        const txCBOffer = await nftmarketplace
          .connect(addr1)
          .createBuyOffer(nftminter.address, i, { value: 1000 + i });
        txCBOffer.wait();
      }

      const count = await nftmarketplace.getAllBidsCount();

      for (let i = 0; i < count; i++) {
        const nftId = await nftmarketplace._makeNftId(nftminter.address, i);
        const bid = await nftmarketplace.bidByIndex(i);

        expect(bid.bid).to.equal(1000 + i);
        expect(bid.nftId).to.equal(nftId);
      }
    });
  });
});
