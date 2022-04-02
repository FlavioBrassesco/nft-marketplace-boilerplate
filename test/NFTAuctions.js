const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const { deployMinter, mint, deployAuctions } = require("./helpers");

const ADDR_0 = "0x0000000000000000000000000000000000000000";
// Hardcoded Gas price in Ganache
const GAS_PRICE = ethers.BigNumber.from("20000000000");
const MAX_DAYS = 7;
const MAX_SUPPLY = 1000;
const FLOOR_PRICE = 100000000000;

describe("NFTMarketplaceAuctions", () => {
  let nftauctions;
  let nftminter;
  let owner, addr1, addr2, addr3;
  beforeEach(async () => {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    nftauctions = await deployAuctions("NFTMarketplaceAuctions", MAX_DAYS);
    nftminter = await deployMinter(
      "NFTMinter",
      "NM1",
      "",
      "",
      MAX_SUPPLY,
      FLOOR_PRICE
    );
  });

  describe("createMarketAuction", () => {
    it("Should revert if panic switch true", async () => {
      const txPanic = await nftauctions.setPanicSwitch(true);
      txPanic.wait();

      await expect(
        nftauctions
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 100000, 1)
      ).to.be.revertedWith("Something went wrong");
    });

    it("Should revert if addr1 tries to create an AuctionItem for a non whitelisted contract", async () => {
      await mint(nftminter, addr1.address, 1);

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      await expect(
        nftauctions
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 100000, 1)
      ).to.be.revertedWith("NFTCollectionManager: Contract is not whitelisted");
    });

    it("Should revert if addr1 tries to create an AuctionItem with floor price 0", async () => {
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      await expect(
        nftauctions
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 0, 1)
      ).to.be.revertedWith("Floor price must be at least 1 wei");
    });

    it("Should revert if addr1 tries to create an AuctionItem with days out of bounds", async () => {
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      await expect(
        nftauctions
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 10000, 0)
      ).to.be.revertedWith("Duration out of bounds");

      await expect(
        nftauctions
          .connect(addr1)
          .createMarketAuction(nftminter.address, 0, 10000, 8)
      ).to.be.revertedWith("Duration out of bounds");
    });

    it("Should pass if addr1 successfully creates an AuctionItem", async () => {
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, 100000, 1);
      txCreateAuction.wait();

      const blockTimeStamp = (
        await waffle.provider.getBlock(txCreateAuction.blockNumber)
      ).timestamp;

      expect(
        (
          await nftauctions.itemOfUserByIndex(
            addr1.address,
            nftminter.address,
            0
          )
        ).seller
      ).to.equal(addr1.address);
      expect(
        (
          await nftauctions.itemOfUserByIndex(
            addr1.address,
            nftminter.address,
            0
          )
        ).currentBidder
      ).to.equal(ADDR_0);
      expect(
        (
          await nftauctions.itemOfUserByIndex(
            addr1.address,
            nftminter.address,
            0
          )
        ).currentBid
      ).to.equal(100000);
      expect(
        (
          await nftauctions.itemOfUserByIndex(
            addr1.address,
            nftminter.address,
            0
          )
        ).endsAt
      ).to.equal(blockTimeStamp + 1 * 24 * 60 * 60);

      expect(
        await nftauctions.getUserItemsCount(addr1.address, nftminter.address)
      ).to.equal(1);
      expect(await nftauctions.getAllItemsCount(nftminter.address)).to.equal(1);

      expect(await nftminter.ownerOf(0)).to.equal(nftauctions.address);
    });
  });

  describe("createAuctionBid", () => {
    it("Should revert if panic switch true", async () => {
      const txPanic = await nftauctions.setPanicSwitch(true);
      txPanic.wait();

      await expect(
        nftauctions
          .connect(addr1)
          .createAuctionBid(nftminter.address, 0, { value: 1000 })
      ).to.be.revertedWith("Something went wrong");
    });

    it("Should revert if addr1 tries to create a bid for its own item", async () => {
      await mint(nftminter, addr1.address, 1);
      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 100000;
      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };

      await expect(
        nftauctions
          .connect(addr1)
          .createAuctionBid(nftminter.address, 0, options)
      ).to.be.revertedWith("Seller is not authorized");
    });

    it("Should revert if addr2 tries to create a second bid for addr1 item", async () => {
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 100000;
      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };
      const txCreateAuctionBid = await nftauctions
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      const options2 = { value: price };
      await expect(
        nftauctions
          .connect(addr2)
          .createAuctionBid(nftminter.address, 0, options2)
      ).to.be.revertedWith("Current bidder can't perform this action");
    });

    it("Should revert if addr2 tries to create a bid when addr1 auction has finished", async () => {
      await mint(nftminter, addr1.address, 1);

      // set whitelist
      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      // set fee
      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      // approve nftauctions to operate for addr1
      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 1000000000;
      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      await ethers.provider.send("evm_increaseTime", [86500]);

      const options = { value: price };
      await expect(
        nftauctions
          .connect(addr2)
          .createAuctionBid(nftminter.address, 0, options)
      ).to.be.revertedWith("Auction has not started or it's already finished");
    });

    it("Should revert if addr2 tries to create a bid lower than floor price", async () => {
      await mint(nftminter, addr1.address, 1);

      // set whitelist
      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      // set fee
      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      // approve nftauctions to operate for addr1
      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 1000000000;
      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price - 1 };
      await expect(
        nftauctions
          .connect(addr2)
          .createAuctionBid(nftminter.address, 0, options)
      ).to.be.revertedWith("Your bid must be equal or higher than floor price");
    });

    it("Should revert if addr3 tries to bid lower than addr2", async () => {
      await mint(nftminter, addr1.address, 1);

      // set whitelist
      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      // set fee
      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      // approve nftauctions to operate for addr1
      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 1000000000;
      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price * 4 };
      const txBid1 = await nftauctions
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txBid1.wait();

      const options2 = { value: price / 2 };
      await expect(
        nftauctions
          .connect(addr3)
          .createAuctionBid(nftminter.address, 0, options2)
      ).to.be.revertedWith("Your bid must be higher than last bid");
    });

    it("Should pass if addr2 successfully creates a bid", async () => {
      await mint(nftminter, addr1.address, 1);

      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 100000;

      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };

      const txCreateAuctionBid = await nftauctions
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      const blockTimeStamp = (
        await waffle.provider.getBlock(txCreateAuctionBid.blockNumber)
      ).timestamp;

      const item = await nftauctions.itemOfUserByIndex(
        addr1.address,
        nftminter.address,
        0
      );

      expect(item.currentBidder).to.equal(addr2.address);
      expect(item.currentBid).to.equal(price);
      expect(item.endsAt).to.equal(blockTimeStamp + 1 * 24 * 60 * 60);
    });
  });

  describe("finishAuctionSale", () => {
    it("Should revert if addr2 tries to finish an auction sale of addr1", async () => {
      await mint(nftminter, addr1.address, 1);

      // set whitelist
      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      // approve nftauctions to operate for addr1
      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 1000000000;
      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };
      const txCreateAuctionBid = await nftauctions
        .connect(addr3)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      await ethers.provider.send("evm_increaseTime", [86500]);

      await expect(
        nftauctions.connect(addr2).finishAuctionSale(nftminter.address, 0)
      ).to.be.revertedWith("Only Auction participants can finish an auction");
    });

    it("Should revert if addr1 tries to finish an auction sale before auction ended", async () => {
      await mint(nftminter, addr1.address, 1);

      // set whitelist
      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      // approve nftauctions to operate for addr1
      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 1000000000;
      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };
      const txCreateAuctionBid = await nftauctions
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      await expect(
        nftauctions.connect(addr1).finishAuctionSale(nftminter.address, 0)
      ).to.be.revertedWith("Auction must be finished to perform this action");
    });

    it("Should pass if addr1 successfully finish an auction sale", async () => {
      await mint(nftminter, addr1.address, 1);

      const provider = waffle.provider;

      // set whitelist
      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      // set fee
      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      // approve nftauctions to operate for addr1
      const txApproval = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApproval.wait();

      const price = 1000000000;
      const fee = ((await nftauctions.getFee(nftminter.address)) * price) / 100;

      const txCreateAuction = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txCreateAuction.wait();

      const options = { value: price };

      const txCreateAuctionBid = await nftauctions
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      await ethers.provider.send("evm_increaseTime", [86500]);

      const addr1BalanceBefore = await provider.getBalance(addr1.address);

      const txFinishAuctionSale = await nftauctions
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
      expect(
        await nftauctions.getUserItemsCount(addr1.address, nftminter.address)
      ).to.equal(0);
      expect(await nftauctions.getAllItemsCount(nftminter.address)).to.equal(0);
    });
  });

  describe("createMarketOwnerAuction meta transactions", () => {
    const makeSignature = async (signer) => {
      // Meta transaction preparation
      const domain = {
        name: await nftauctions.name(),
        version: await nftauctions.ERC712_VERSION(),
        verifyingContract: nftauctions.address,
        salt: ethers.utils.hexZeroPad(
          (await nftauctions.getChainId()).toHexString(),
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
        nonce: await nftauctions.getNonce(signer.address),
        from: signer.address,
        functionSignature: nftauctions.interface.getSighash(
          `createMarketOwnerAuction(address,address,uint256)`
        ),
      };

      // Meta transaction signing
      const signature = await signer._signTypedData(
        domain,
        types,
        MetaTransaction
      );
      return [signature, MetaTransaction];
    };

    it("Should revert if panic switch true", async () => {
      const txPanic = await nftauctions.setPanicSwitch(true);
      txPanic.wait();
      // not metatx but ok for test
      await expect(
        nftauctions.createMarketOwnerAuction(
          addr1.address,
          nftminter.address,
          0,
          { value: 1000 }
        )
      ).to.be.revertedWith("Something went wrong");
    });

    it("Should revert if addr1 tries to createMarketOwnerAuction signed by addr2", async () => {
      await mint(nftminter, addr2.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user owner allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr2)
        .setApprovalForAll(nftauctions.address, true);
      tx2.wait();

      // set floor price & fee
      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      const price = 10000;
      const txFloorPrice = await nftauctions.setFloorPrice(
        nftminter.address,
        price
      );
      txFloorPrice.wait();

      const [signature, MetaTransaction] = await makeSignature(addr2);

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const options = {
        value: price,
      };
      await expect(
        nftauctions
          .connect(addr1)
          ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8,bytes)"](
            MetaTransaction.from,
            MetaTransaction.functionSignature,
            r,
            s,
            v,
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "uint256"],
              [addr1.address, nftminter.address, 0]
            ),
            options
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if addr1 tries to createMarketOwnerAuction for non whitelisted contract", async () => {
      await mint(nftminter, owner.address, 1);

      // user owner allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(owner)
        .setApprovalForAll(nftauctions.address, true);
      tx2.wait();

      const [signature, MetaTransaction] = await makeSignature(owner);

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const options = {
        value: 10000,
      };
      await expect(
        nftauctions
          .connect(addr1)
          ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8,bytes)"](
            MetaTransaction.from,
            MetaTransaction.functionSignature,
            r,
            s,
            v,
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "uint256"],
              [addr1.address, nftminter.address, 0]
            ),
            options
          )
      ).to.be.revertedWith("NFTCollectionManager: Contract is not whitelisted");
    });

    it("Should revert if addr1 tries to createMarketOwnerAuction for a contract with no floor price", async () => {
      await mint(nftminter, owner.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user owner allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(owner)
        .setApprovalForAll(nftauctions.address, true);
      tx2.wait();

      const [signature, MetaTransaction] = await makeSignature(owner);

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const options = {
        value: 10000,
      };
      await expect(
        nftauctions
          .connect(addr1)
          ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8,bytes)"](
            MetaTransaction.from,
            MetaTransaction.functionSignature,
            r,
            s,
            v,
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "uint256"],
              [addr1.address, nftminter.address, 0]
            ),
            options
          )
      ).to.be.revertedWith("Floor price must be greater than 0");
    });

    it("Should revert if addr1 tries to createMarketOwnerAuction with a value lower than floor price", async () => {
      await mint(nftminter, owner.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user owner allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(owner)
        .setApprovalForAll(nftauctions.address, true);
      tx2.wait();

      // set floor price & fee
      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      const price = 10000;
      const txFloorPrice = await nftauctions.setFloorPrice(
        nftminter.address,
        price
      );
      txFloorPrice.wait();

      const [signature, MetaTransaction] = await makeSignature(owner);

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const options = {
        value: price - 1,
      };
      await expect(
        nftauctions
          .connect(addr1)
          ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8,bytes)"](
            MetaTransaction.from,
            MetaTransaction.functionSignature,
            r,
            s,
            v,
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "uint256"],
              [addr1.address, nftminter.address, 0]
            ),
            options
          )
      ).to.be.revertedWith("Value sent must be greater than floor price");
    });

    it("Should pass if addr1 successfully creates an auction bid through createMarketOwnerAuction meta transaction", async () => {
      await mint(nftminter, owner.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user owner allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(owner)
        .setApprovalForAll(nftauctions.address, true);
      tx2.wait();

      // set floor price & fee
      const price = 10000;

      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      const txFloorPrice = await nftauctions.setFloorPrice(
        nftminter.address,
        price
      );
      txFloorPrice.wait();

      const options = {
        value: price,
      };

      const [signature, MetaTransaction] = await makeSignature(owner);

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const txMOAuction = await nftauctions
        .connect(addr1)
        ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8,bytes)"](
          MetaTransaction.from,
          MetaTransaction.functionSignature,
          r,
          s,
          v,
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256"],
            [addr1.address, nftminter.address, 0]
          ),
          options
        );
      txMOAuction.wait();

      const blockTimestamp = (
        await waffle.provider.getBlock(txMOAuction.blockNumber)
      ).timestamp;

      expect(
        (
          await nftauctions.itemOfUserByIndex(
            owner.address,
            nftminter.address,
            0
          )
        ).currentBidder
      ).to.equal(addr1.address);
      expect(
        (
          await nftauctions.itemOfUserByIndex(
            owner.address,
            nftminter.address,
            0
          )
        ).currentBid
      ).to.equal(price);
      expect(
        (
          await nftauctions.itemOfUserByIndex(
            owner.address,
            nftminter.address,
            0
          )
        ).endsAt
      ).to.equal(blockTimestamp + 7 * 24 * 60 * 60);
    });
  });

  describe("transferSalesFees", () => {
    it("Should revert if transferSalesFees is not called by owner", async () => {
      await expect(
        nftauctions.connect(addr1).transferSalesFees()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if owner tries to call transferSalesFees but there are no sales fees to transfer", async () => {
      await mint(nftminter, addr1.address, 2);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets fee
      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      tx2.wait();

      const price = 100000000000;
      // addr1 creates AuctionItem 0
      const txMA1 = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txMA1.wait();

      const options = { value: price };
      // addr2 creates AuctionBid 0
      const txCreateAuctionBid = await nftauctions
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      await expect(nftauctions.transferSalesFees()).to.be.revertedWith(
        "No sales fees to retrieve"
      );
    });

    it("Should pass if sales fees are ok and get successfully transferred to owner", async () => {
      const provider = waffle.provider;

      await mint(nftminter, addr1.address, 2);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets fee
      const txFee = await nftauctions.setFee(nftminter.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      tx2.wait();

      const price = 100000000000;
      const price2 = 2000000000000;
      const fee = ((await nftauctions.getFee(nftminter.address)) * price) / 100;

      // addr1 creates AuctionItem 0
      const txMA1 = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 0, price, 1);
      txMA1.wait();
      // addr1 creates AuctionItem 1 (7 days)
      const txMA2 = await nftauctions
        .connect(addr1)
        .createMarketAuction(nftminter.address, 1, price2, 7);
      txMA2.wait();

      let options = { value: price };

      // addr2 creates AuctionBid 0
      const txCreateAuctionBid = await nftauctions
        .connect(addr2)
        .createAuctionBid(nftminter.address, 0, options);
      txCreateAuctionBid.wait();

      options = { value: price2 };

      // addr2 creates AuctionBid 1
      const txCreateAuctionBid2 = await nftauctions
        .connect(addr2)
        .createAuctionBid(nftminter.address, 1, options);
      txCreateAuctionBid2.wait();

      const marketBalanceBefore = await provider.getBalance(
        nftauctions.address
      );

      await ethers.provider.send("evm_increaseTime", [86500]);

      const tx4 = await nftauctions
        .connect(addr1)
        .finishAuctionSale(nftminter.address, 0);
      tx4.wait();

      const ownerBalanceBefore = await provider.getBalance(owner.address);

      const txTransferSalesFees = await nftauctions.transferSalesFees();
      txTransferSalesFees.wait();

      const gasUsed = (
        await provider.getTransactionReceipt(txTransferSalesFees.hash)
      ).gasUsed;
      const gasFee = gasUsed.mul(GAS_PRICE);

      const ownerBalanceAfter = await provider.getBalance(owner.address);

      const marketBalanceAfter = await provider.getBalance(nftauctions.address);

      expect(ownerBalanceAfter).to.be.equal(
        ownerBalanceBefore.sub(gasFee).add(fee)
      );
      expect(marketBalanceAfter).to.be.equal(marketBalanceBefore - price);
    });
  });

  describe("AuctionItem Enumeration", () => {
    it("Should pass if enumeration of all AuctionItems for addr1 is ok", async () => {
      const qty = 3;
      await mint(nftminter, addr1.address, qty);

      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApprove = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApprove.wait();

      const price = 1000;
      const timestamps = [];
      for (let i = 0; i < qty; i++) {
        const txCreate = await nftauctions
          .connect(addr1)
          .createMarketAuction(nftminter.address, i, price + i, i + 1);
        txCreate.wait();
        timestamps[i] = (
          await waffle.provider.getBlock(txCreate.blockNumber)
        ).timestamp;
      }

      const userItemsCount = await nftauctions.getUserItemsCount(
        addr1.address,
        nftminter.address
      );

      const userItems = [];
      for (let i = 0; i < userItemsCount; i++) {
        const item = await nftauctions.itemOfUserByIndex(
          addr1.address,
          nftminter.address,
          i
        );
        userItems.push(item);
      }

      userItems.forEach((it, i) => {
        expect(it.seller).to.equal(addr1.address);
        expect(it.currentBidder).to.equal(ADDR_0);
        expect(it.currentBid).to.equal(price + i);
        expect(it.endsAt).to.equal(timestamps[i] + (i + 1) * 24 * 60 * 60);
      });
    });

    it("Should pass if enumeration of all AuctionItems is ok", async () => {
      const qty = 2;
      await mint(nftminter, addr1.address, qty);
      await mint(nftminter, addr2.address, qty);

      const txWhitelist = await nftauctions.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApprove = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftauctions.address, true);
      txApprove.wait();

      const txApprove2 = await nftminter
        .connect(addr2)
        .setApprovalForAll(nftauctions.address, true);
      txApprove2.wait();

      const price = 1000;
      const timestamps = [];
      for (let i = 0; i < qty; i++) {
        const txCreate = await nftauctions
          .connect(addr1)
          .createMarketAuction(nftminter.address, i, price + i, i + 1);
        txCreate.wait();
        timestamps[i] = (
          await waffle.provider.getBlock(txCreate.blockNumber)
        ).timestamp;
      }

      const price2 = 2000;
      for (let i = 2; i < qty + 2; i++) {
        const txCreate = await nftauctions
          .connect(addr2)
          .createMarketAuction(nftminter.address, i, price2 + i, i + 1);
        txCreate.wait();
        timestamps[i] = (
          await waffle.provider.getBlock(txCreate.blockNumber)
        ).timestamp;
      }

      const allItemsCount = await nftauctions.getAllItemsCount(
        nftminter.address
      );

      const allItems = [];
      for (let i = 0; i < allItemsCount; i++) {
        const item = await nftauctions.itemByIndex(nftminter.address, i);
        allItems.push(item);
      }

      for (let i = 0; i < qty; i++) {
        expect(allItems[i].seller).to.equal(addr1.address);
        expect(allItems[i].currentBidder).to.equal(ADDR_0);
        expect(allItems[i].currentBid).to.equal(price + i);
        expect(allItems[i].endsAt).to.equal(
          timestamps[i] + (i + 1) * 24 * 60 * 60
        );
      }
      for (let i = 2; i < qty + 2; i++) {
        expect(allItems[i].seller).to.equal(addr2.address);
        expect(allItems[i].currentBidder).to.equal(ADDR_0);
        expect(allItems[i].currentBid).to.equal(price2 + i);
        expect(allItems[i].endsAt).to.equal(
          timestamps[i] + (i + 1) * 24 * 60 * 60
        );
      }
    });
  });
});
