const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const {
  deployMinter,
  mint,
  deployManager,
  deployMarketplaceAuctions,
} = require("./helpers");

const ADDR_0 = "0x0000000000000000000000000000000000000000";
// Hardcoded Gas price in Ganache
const GAS_PRICE = ethers.BigNumber.from("20000000000");
const MAX_DAYS = 7;

describe("NFTMarketplaceAuctions", () => {
  let nftmarketplace;
  let nftcontractmanager;
  let nftminter;
  beforeEach(async () => {
    nftcontractmanager = await deployManager();
    nftmarketplace = await deployMarketplaceAuctions(
      "NFTMarketplace",
      nftcontractmanager.address,
      MAX_DAYS
    );
    nftminter = await deployMinter("NFTMinter", "NM1", "", "", 1000, 1000);
  });

  describe("Create Auction Item", () => {
    it("Should revert if addr1 tries to create an AuctionItem for a non whitelisted contract", async () => {
      // arrange
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApproval.wait();

      await expect(
        nftmarketplace
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 100000, 1)
      ).to.be.revertedWith("Contract is not auctionable");
    });

    it("Should revert if addr1 tries to create an AuctionItem with floor price 0", async () => {
      // arrange
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApproval.wait();

      await expect(
        nftmarketplace
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 0, 1)
      ).to.be.revertedWith("Floor price must be at least 1 wei");
    });

    it("Should revert if addr1 tries to create an AuctionItem with days out of bounds", async () => {
      // arrange
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApproval.wait();

      await expect(
        nftmarketplace
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 10000, 0)
      ).to.be.revertedWith("Duration out of bounds");

      await expect(
        nftmarketplace
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 10000, 8)
      ).to.be.revertedWith("Duration out of bounds");
    });

    it("Should pass if successfully addr1 creates an AuctionItem", async () => {
      // arrange
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApproval.wait();

      const txCreateAuction = await nftmarketplace
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, 100000, 1);
      txCreateAuction.wait();

      const blockTimeStamp = (
        await waffle.provider.getBlock(txCreateAuction.blockNumber)
      ).timestamp;

      expect(
        (await nftmarketplace.itemOfUserByIndex(addr1.address, 0)).seller
      ).to.equal(addr1.address);
      expect(
        (await nftmarketplace.itemOfUserByIndex(addr1.address, 0)).currentBidder
      ).to.equal(ADDR_0);
      expect(
        (await nftmarketplace.itemOfUserByIndex(addr1.address, 0)).currentBid
      ).to.equal(100000);
      expect(
        (await nftmarketplace.itemOfUserByIndex(addr1.address, 0)).endsAt
      ).to.equal(blockTimeStamp + 1 * 24 * 60 * 60);

      expect(await nftmarketplace.getUserItemsCount(addr1.address)).to.equal(1);
      expect(await nftmarketplace.getAllItemsCount()).to.equal(1);

      expect(await nftminter.ownerOf(0)).to.equal(nftmarketplace.address);
    });

    it("Should pass if addr2 successfully creates a bid", async () => {
      // arrange
      const [, addr1, addr2] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApproval.wait();

      const price = 100000;

      const txCreateAuction = await nftmarketplace
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };

      const txCreateAuctionBid = await nftmarketplace
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      const blockTimeStamp = (
        await waffle.provider.getBlock(txCreateAuctionBid.blockNumber)
      ).timestamp;

      expect(
        (await nftmarketplace.itemOfUserByIndex(addr1.address, 0)).currentBidder
      ).to.equal(addr2.address);
      expect(
        (await nftmarketplace.itemOfUserByIndex(addr1.address, 0)).currentBid
      ).to.equal(price);
      expect(
        (await nftmarketplace.itemOfUserByIndex(addr1.address, 0)).endsAt
      ).to.equal(blockTimeStamp + 1 * 24 * 60 * 60);
    });

    it("Should pass if addr1 successfully finish an auction sale", async () => {
      // arrange
      const [, addr1, addr2] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      const provider = waffle.provider;

      // set whitelist
      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      // set fee
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      // approve nftmarketplace to operate for addr1
      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApproval.wait();

      const price = 1000000000;
      const fee =
        ((await nftcontractmanager.getFee(nftminter.address)) * price) / 100;

      const txCreateAuction = await nftmarketplace
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };

      const txCreateAuctionBid = await nftmarketplace
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      await ethers.provider.send("evm_increaseTime", [86500]);

      const addr1BalanceBefore = await provider.getBalance(addr1.address);

      const txFinishAuctionSale = await nftmarketplace
        .connect(addr1)
        .finishAuctionSale(nftminter.address, 0);
      txFinishAuctionSale.wait();

      const addr1BalanceAfter = await provider.getBalance(addr1.address);

      const gasUsed = (
        await provider.getTransactionReceipt(txFinishAuctionSale.hash)
      ).gasUsed;
      const gasFee = gasUsed.mul(GAS_PRICE);

      expect(addr1BalanceAfter).to.be.equal(
        addr1BalanceBefore.sub(gasFee).add(price).sub(fee)
      );
      expect(await nftmarketplace.getUserItemsCount(addr1.address)).to.equal(0);
      expect(await nftmarketplace.getAllItemsCount()).to.equal(0);
    });

    it("Should pass if addr2 successfully retrieves an auction item", async () => {
      // arrange
      const [, addr1, addr2] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApproval.wait();

      const price = 100000;

      const txCreateAuction = await nftmarketplace
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };

      const txCreateAuctionBid = await nftmarketplace
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      await ethers.provider.send("evm_increaseTime", [86500]);

      const txFinishAuctionSale = await nftmarketplace
        .connect(addr2)
        .retrieveAuctionItem(nftminter.address, 0);
      txFinishAuctionSale.wait();

      expect(await nftminter.ownerOf(0)).to.equal(addr2.address);
    });

    it("Should pass if addr1 successfully creates an auction bid through createMarketOwnerAuction meta transaction", async () => {
      // arrange
      const [owner, addr1] = await ethers.getSigners();
      await mint(nftminter, owner.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user owner allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(owner)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // set floor price & fee
      const price = 10000;

      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      const txFloorPrice = await nftcontractmanager.setFloorPrice(
        nftminter.address,
        price
      );
      txFloorPrice.wait();

      const options = {
        value: price,
      };

      // Meta transaction preparation
      const domain = {
        name: await nftmarketplace.name(),
        version: await nftmarketplace.ERC712_VERSION(),
        verifyingContract: nftmarketplace.address,
        salt: ethers.utils.hexZeroPad(
          (await nftmarketplace.getChainId()).toHexString(),
          32
        ),
      };

      const types = {
        MetaTransaction: [
          { name: "nonce", type: "uint256" },
          { name: "from", type: "address" },
          { name: "functionSignature", type: "bytes" },
        ],
      };

      const MetaTransaction = {
        nonce: await nftmarketplace.getNonce(owner.address),
        from: owner.address,
        functionSignature: nftmarketplace.interface.getSighash(
          `createMarketOwnerAuction(address,address,uint32)`
        ),
      };

      // Meta transaction signing
      const signature = await owner._signTypedData(
        domain,
        types,
        MetaTransaction
      );

      const { r, s, v } = ethers.utils.splitSignature(signature);

      // assert
      const txMOAuction = await nftmarketplace
        .connect(addr1)
        ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8,bytes)"](
          MetaTransaction.from,
          MetaTransaction.functionSignature,
          r,
          s,
          v,
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint32"],
            [addr1.address, nftminter.address, 0]
          ),
          options
        );
      txMOAuction.wait();

      const blockTimestamp = (
        await waffle.provider.getBlock(txMOAuction.blockNumber)
      ).timestamp;

      expect(
        (await nftmarketplace.itemOfUserByIndex(owner.address, 0)).currentBidder
      ).to.equal(addr1.address);
      expect(
        (await nftmarketplace.itemOfUserByIndex(owner.address, 0)).currentBid
      ).to.equal(price);
      expect(
        (await nftmarketplace.itemOfUserByIndex(owner.address, 0)).endsAt
      ).to.equal(blockTimestamp + 7 * 24 * 60 * 60);
    });

    it("Should pass if sales fees are ok and get successfully transferred to owner", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const provider = waffle.provider;

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

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      const price = 100000000000;
      const price2 = 2000000000000;
      const fee =
        ((await nftcontractmanager.getFee(nftminter.address)) * price) / 100;

      // addr1 creates AuctionItem 0
      const txMA1 = await nftmarketplace
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txMA1.wait();
      // addr1 creates AuctionItem 1 (7 days)
      const txMA2 = await nftmarketplace
        .connect(addr1)
        .createMarketAuction(nftminter.address, 1, price2, 7);
      txMA2.wait();

      let options = { value: price };

      // addr2 creates AuctionBid 0
      const txCreateAuctionBid = await nftmarketplace
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      options = { value: price2 };

      // addr2 creates AuctionBid 1
      const txCreateAuctionBid2 = await nftmarketplace
        .connect(addr2)
        .createAuctionBid(nftminter.address, 1, options);
      txCreateAuctionBid2.wait();

      const marketBalanceBefore = await provider.getBalance(
        nftmarketplace.address
      );

      await ethers.provider.send("evm_increaseTime", [86500]);

      const tx4 = await nftmarketplace
        .connect(addr1)
        .finishAuctionSale(nftminter.address, 0);
      tx4.wait();

      const ownerBalanceBefore = await provider.getBalance(owner.address);

      const txTransferSalesFees = await nftmarketplace.transferSalesFees();
      txTransferSalesFees.wait();

      const gasUsed = (
        await provider.getTransactionReceipt(txTransferSalesFees.hash)
      ).gasUsed;
      const gasFee = gasUsed.mul(GAS_PRICE);

      const ownerBalanceAfter = await provider.getBalance(owner.address);

      const marketBalanceAfter = await provider.getBalance(
        nftmarketplace.address
      );

      expect(ownerBalanceAfter).to.be.equal(
        ownerBalanceBefore.sub(gasFee).add(fee)
      );
      expect(marketBalanceAfter).to.be.equal(marketBalanceBefore - price);
    });

    it("Should pass if item enumeration works ok", async () => {
      const [, addr1] = await ethers.getSigners();

      const provider = waffle.provider;

      const qty = 3;

      await mint(nftminter, addr1.address, qty);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets fee
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      const price = 100000000000;

      for (let i = 0; i < qty; i++) {
        // addr1 creates AuctionItem 0
        const txMA = await nftmarketplace
          .connect(addr1)
          .createMarketAuction(nftminter.address, i, price, 1);
        txMA.wait();
      }

      expect(await nftmarketplace.getUserItemsCount(addr1.address)).to.equal(
        qty
      );
      expect(await nftmarketplace.getAllItemsCount()).to.equal(qty);

      await ethers.provider.send("evm_increaseTime", [86500]);

      for (let i = 0; i < qty; i++) {
        // addr1 creates AuctionItem 0
        const txFA = await nftmarketplace
          .connect(addr1)
          .finishAuctionSale(nftminter.address, i);
        txFA.wait();
      }

      expect(await nftmarketplace.getUserItemsCount(addr1.address)).to.equal(0);
      expect(await nftmarketplace.getAllItemsCount()).to.equal(0);
    });
  });
});
