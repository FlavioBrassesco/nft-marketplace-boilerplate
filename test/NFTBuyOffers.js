const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const { deployMinter, mint, deployBuyOffers } = require("./helpers");

const ADDR_0 = "0x0000000000000000000000000000000000000000";
// Hardcoded Gas price in Ganache
const GAS_PRICE = ethers.BigNumber.from("20000000000");
const MAX_DAYS = 7;
const MAX_SUPPLY = 1000;
const FLOOR_PRICE = 100000000000;

describe("NFTMarketplaceBuyOffers", () => {
  let nftbuyoffers;
  let nftminter;
  let owner, addr1, addr2, addr3;
  beforeEach(async () => {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    nftbuyoffers = await deployBuyOffers("NFTMarketplaceBuyOffers", MAX_DAYS);
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
      const txPanic = await nftbuyoffers.setPanicSwitch(true);
      txPanic.wait();

      await expect(
        nftbuyoffers
          .connect(addr1)
          .createBuyOffer(nftminter.address, 0, { value: 1000 })
      ).to.be.revertedWith("Something went wrong");
    });

    it("Should revert if making an offer for a token of non-whitelisted contract", async () => {
      await expect(
        nftbuyoffers.connect(addr1).createBuyOffer(nftminter.address, 0)
      ).to.be.revertedWith("NFTCollectionManager: Contract is not whitelisted");
    });

    it("Should revert if offer is 0", async () => {
      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      await expect(
        nftbuyoffers.connect(addr1).createBuyOffer(nftminter.address, 0)
      ).to.be.revertedWith("Price must be at least 1 wei");
    });

    it("Should revert if addr2 already has an offer for addr1 item", async () => {
      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 10000 };
      const txCBOffer = await nftbuyoffers
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      await expect(
        nftbuyoffers
          .connect(addr1)
          .createBuyOffer(nftminter.address, 0, options)
      ).to.be.revertedWith("You already have an offer for this item");
    });

    it("Should pass if addr1 successfully creates a buy offer for an item", async () => {
      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 10000 };
      const txCBOffer = await nftbuyoffers
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      expect(
        await nftbuyoffers.getUserBidsCount(addr1.address, nftminter.address)
      ).to.equal(1);
      expect(
        await nftbuyoffers.bidOfUserByIndex(addr1.address, nftminter.address, 0)
      ).to.equal(options.value);
    });

    it("Should pass if two users successfully create a buy offer for same item", async () => {
      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 10000 };
      const txCBOffer = await nftbuyoffers
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      const options2 = { value: 12000 };
      const txCBOffer2 = await nftbuyoffers
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, options2);
      txCBOffer2.wait();

      expect(
        await nftbuyoffers.getUserBidsCount(addr1.address, nftminter.address)
      ).to.equal(1);
      expect(
        await nftbuyoffers.bidOfUserByIndex(addr1.address, nftminter.address, 0)
      ).to.equal(options.value);
      expect(
        await nftbuyoffers.getUserBidsCount(addr2.address, nftminter.address)
      ).to.equal(1);
      expect(
        await nftbuyoffers.bidOfUserByIndex(addr2.address, nftminter.address, 0)
      ).to.equal(options2.value);
    });
  });

  describe("cancelBuyOffer", () => {
    it("Should revert if addr1 has no active offer for the specified item", async () => {
      await expect(
        nftbuyoffers.connect(addr1).cancelBuyOffer(nftminter.address, 0)
      ).to.be.revertedWith("No active offer found");
    });

    it("Should pass if addr2 successfully cancels a buy offer for addr1 item", async () => {
      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 10000 };
      const txCBOffer = await nftbuyoffers
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      expect(
        await nftbuyoffers.getUserBidsCount(addr1.address, nftminter.address)
      ).to.equal(1);
      expect(
        await nftbuyoffers.bidOfUserByIndex(addr1.address, nftminter.address, 0)
      ).to.equal(options.value);

      const txCBCancel = await nftbuyoffers
        .connect(addr1)
        .cancelBuyOffer(nftminter.address, 0);
      txCBCancel.wait();

      expect(
        await nftbuyoffers.getUserBidsCount(addr1.address, nftminter.address)
      ).to.equal(0);
      await expect(
        nftbuyoffers.bidOfUserByIndex(addr1.address, nftminter.address, 0)
      ).to.be.revertedWith("User Bid index out of bounds");
    });
  });

  describe("acceptBuyOffer", () => {
    it("Should revert if offer is not found", async () => {
      await expect(
        nftbuyoffers
          .connect(addr1)
          .acceptBuyOffer(nftminter.address, 0, addr2.address)
      ).to.be.revertedWith("No active offer found");
    });

    it("Should pass if addr1 successfully accepts addr2 buy offer", async () => {
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txSetApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftbuyoffers.address, true);
      txSetApproval.wait();

      const txFee = await nftbuyoffers.setFee(nftminter.address, 10);
      txFee.wait();

      const price = 10000;
      const fee =
        ((await nftbuyoffers.getFee(nftminter.address)) * price) / 100;
      const options = { value: price };
      const txCBOffer = await nftbuyoffers
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      const addr1BalanceBefore = await waffle.provider.getBalance(
        addr1.address
      );

      const marketBalanceBefore = await waffle.provider.getBalance(
        nftbuyoffers.address
      );

      const txAccept = await nftbuyoffers
        .connect(addr1)
        .acceptBuyOffer(nftminter.address, 0, addr2.address);
      txAccept.wait();

      const gasUsed = (
        await waffle.provider.getTransactionReceipt(txAccept.hash)
      ).gasUsed;
      const gasFee = gasUsed.mul(GAS_PRICE);

      const addr1BalanceAfter = await waffle.provider.getBalance(addr1.address);

      const marketBalanceAfter = await waffle.provider.getBalance(
        nftbuyoffers.address
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
      await expect(
        nftbuyoffers.connect(addr1).transferSalesFees()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if owner tries to call transferSalesFees but there are no sales fees to transfer", async () => {
      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const options = { value: 100000 };
      // addr2 creates Buy Offer
      const txCreateBuyOffer = await nftbuyoffers
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, options);
      txCreateBuyOffer.wait();

      await expect(nftbuyoffers.transferSalesFees()).to.be.revertedWith(
        "No sales fees to retrieve"
      );
    });

    it("Should pass if sales fees are successfully transferred to owner", async () => {
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txSetApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftbuyoffers.address, true);
      txSetApproval.wait();

      const txFee = await nftbuyoffers.setFee(nftminter.address, 10);
      txFee.wait();

      const marketBalanceBefore = await waffle.provider.getBalance(
        nftbuyoffers.address
      );

      const price = 10000;
      const fee =
        ((await nftbuyoffers.getFee(nftminter.address)) * price) / 100;

      const options = { value: price };
      const txCBOffer = await nftbuyoffers
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, options);
      txCBOffer.wait();

      const txAccept = await nftbuyoffers
        .connect(addr1)
        .acceptBuyOffer(nftminter.address, 0, addr2.address);
      txAccept.wait();

      const ownerBalanceBefore = await waffle.provider.getBalance(
        owner.address
      );

      const txTransferSalesFees = await nftbuyoffers.transferSalesFees();
      txTransferSalesFees.wait();

      const gasUsed = (
        await waffle.provider.getTransactionReceipt(txTransferSalesFees.hash)
      ).gasUsed;
      const gasFee = gasUsed.mul(GAS_PRICE);

      const ownerBalanceAfter = await waffle.provider.getBalance(owner.address);

      const marketBalanceAfter = await waffle.provider.getBalance(
        nftbuyoffers.address
      );

      expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore.sub(gasFee).add(fee)
      );
      expect(marketBalanceAfter).to.equal(marketBalanceBefore);
    });
  });

  describe("BuyOffer Enumeration", () => {
    it("Should pass if all buy offers of addr1 are ok", async () => {
      const qty = 3;

      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      for (let i = 0; i < qty; i++) {
        const txCBOffer = await nftbuyoffers
          .connect(addr1)
          .createBuyOffer(nftminter.address, i, { value: 1000 + i });
        txCBOffer.wait();
      }

      const count = await nftbuyoffers.getUserBidsCount(
        addr1.address,
        nftminter.address
      );

      for (let i = 0; i < count; i++) {
        const bid = await nftbuyoffers.bidOfUserByIndex(
          addr1.address,
          nftminter.address,
          i
        );

        expect(bid).to.equal(1000 + i);
      }
    });

    it("Should pass if all buy offers of token 0 are ok", async () => {
      const txWhitelist = await nftbuyoffers.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txCBOffer = await nftbuyoffers
        .connect(addr1)
        .createBuyOffer(nftminter.address, 0, { value: 1000 });
      txCBOffer.wait();
      const txCBOffer2 = await nftbuyoffers
        .connect(addr2)
        .createBuyOffer(nftminter.address, 0, { value: 1000 + 1 });
      txCBOffer2.wait();
      const txCBOffer3 = await nftbuyoffers
        .connect(addr3)
        .createBuyOffer(nftminter.address, 0, { value: 1000 + 2 });
      txCBOffer3.wait();

      const count = await nftbuyoffers.getAllBidsCount(nftminter.address, 0);

      for (let i = 0; i < count; i++) {
        const bid = await nftbuyoffers.bidByIndex(nftminter.address, 0, i);

        expect(bid.bid).to.equal(1000 + i);
      }
    });
  });
});
