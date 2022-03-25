const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const {
  deployMinter,
  mint,
  deployManager,
  deployMarketplace,
} = require("./helpers");

const ADDR_0 = "0x0000000000000000000000000000000000000000";
// Hardcoded Gas price in Ganache
const GAS_PRICE = ethers.BigNumber.from("20000000000");

describe("NFTMarketplace", () => {
  let nftmarketplace;
  let nftcontractmanager;
  let nftminter;
  beforeEach(async () => {
    nftcontractmanager = await deployManager();
    nftmarketplace = await deployMarketplace(
      "NFTMarketplace",
      nftcontractmanager.address
    );
    nftminter = await deployMinter("NFTMinter", "NM1", "", "", 1000, 1000);
  });

  describe("ERC721Holder", function () {
    it("Should pass if IERC721Receiver is implemented", async () => {
      const [owner, addr1] = await ethers.getSigners();

      expect(
        await nftmarketplace.callStatic.onERC721Received(
          owner.address,
          addr1.address,
          0,
          "0xffffffff"
        )
      ).to.equal("0x150b7a02");
    });
  });

  describe("createMarketItem", () => {
    it("Should revert if addr1 tries to create an MarketItem for a non whitelisted contract", async () => {
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      await expect(
        nftmarketplace
          .connect(addr1)
          .createMarketItem(nftminter.address, 0, 10000)
      ).to.be.revertedWith("Contract not allowed");
    });

    it("Should revert if addr1 tries to create a MarketItem with price 0", async () => {
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      await expect(
        nftmarketplace.connect(addr1).createMarketItem(nftminter.address, 0, 0)
      ).to.be.revertedWith("Price must be at least 1 wei");
    });

    it("Should pass if addr1 successfully creates a MarketItem", async () => {
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, 10000);
      tx3.wait();

      expect(await nftmarketplace.getUserItemsCount(addr1.address)).to.equal(1);
      expect(await nftmarketplace.getAllItemsCount()).to.equal(1);
      expect(await nftminter.ownerOf(0)).to.equal(nftmarketplace.address);
    });
  });

  describe("cancelMarketItem", () => {
    it("Should revert if addr1 tries to cancel a non for sale MarketItem", async () => {
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 2);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, 10000);
      tx3.wait();

      // user cancels MarketItem
      await expect(
        nftmarketplace.connect(addr1).cancelMarketItem(nftminter.address, 1)
      ).to.be.revertedWith("Item not for sale");
    });

    it("Should revert if addr2 tries to cancel a MarketItem of addr1", async () => {
      const [, addr1, addr2] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, 10000);
      tx3.wait();

      // user cancels MarketItem
      await expect(
        nftmarketplace.connect(addr2).cancelMarketItem(nftminter.address, 0)
      ).to.be.revertedWith("Only seller allowed");
    });

    it("Should pass if addr1 successfully cancels a MarketItem", async () => {
      const [, addr1] = await ethers.getSigners();
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, 10000);
      tx3.wait();

      // user cancels MarketItem
      const tx4 = await nftmarketplace
        .connect(addr1)
        .cancelMarketItem(nftminter.address, 0);
      tx4.wait();

      expect(await nftminter.ownerOf(0)).to.equal(addr1.address);
      expect(await nftmarketplace.getUserItemsCount(addr1.address)).to.equal(0);
      expect(await nftmarketplace.getAllItemsCount()).to.equal(0);
    });
  });

  describe("createMarketSale", () => {
    it("Should revert if addr2 tries to buy a MarketItem that is not for sale", async () => {
      const [, addr1, addr2] = await ethers.getSigners();

      await mint(nftminter, addr1.address, 2);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, 10000);
      tx3.wait();

      const options = {
        value: 10000,
      };
      await expect(
        nftmarketplace
          .connect(addr2)
          .createMarketSale(nftminter.address, 1, options)
      ).to.be.revertedWith("Item not for sale");
    });

    it("Should revert if addr1 tries to buy his own MarketItem", async () => {
      const [, addr1] = await ethers.getSigners();

      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, 10000);
      tx3.wait();

      const options = {
        value: 10000,
      };
      await expect(
        nftmarketplace
          .connect(addr1)
          .createMarketSale(nftminter.address, 0, options)
      ).to.be.revertedWith("Seller not allowed");
    });

    it("Should revert if addr2 tries to buy with msg.value != price", async () => {
      const [, addr1, addr2] = await ethers.getSigners();

      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, 10000);
      tx3.wait();

      const options = {
        value: 5000,
      };
      await expect(
        nftmarketplace
          .connect(addr2)
          .createMarketSale(nftminter.address, 0, options)
      ).to.be.revertedWith("msg.value is not == Asking price");
    });
    it("Should pass if addr2 successfully buys a MarketItem", async () => {
      const [, addr1, addr2] = await ethers.getSigners();

      const provider = waffle.provider;

      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      const price = 10000;

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, price);
      tx3.wait();

      const addr1BalanceBefore = await provider.getBalance(addr1.address);
      const nftmarketplaceBalanceBefore = await provider.getBalance(
        nftmarketplace.address
      );

      const options = {
        value: price,
      };
      // user buys market item
      const tx4 = await nftmarketplace
        .connect(addr2)
        .createMarketSale(nftminter.address, 0, options);
      tx4.wait();

      const addr1BalanceAfter = await provider.getBalance(addr1.address);
      const nftmarketplaceBalanceAfter = await provider.getBalance(
        nftmarketplace.address
      );

      // calculating secondary sales fee
      const fee =
        ((await nftcontractmanager.getFee(nftminter.address)) * price) / 100;
      const payment = price - fee;

      // checking that transfer was successful
      expect(await nftminter.ownerOf(0)).to.equal(addr2.address);
      // checking that payment was correct
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.add(payment));
      expect(nftmarketplaceBalanceAfter).to.equal(
        nftmarketplaceBalanceBefore.add(fee)
      );
    });
  });

  describe("createMarketOwnerSale", () => {
    it("Should pass if addr2 tries to sign for addr1 to buy an item through createOwnerSale MetaTransaction", async () => {
      const [, addr1, addr2] = await ethers.getSigners();

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      tx.wait();

      // set fee and floor price
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      const price = 10000;
      const txFloorPrice = await nftcontractmanager.setFloorPrice(
        nftminter.address,
        price
      );
      txFloorPrice.wait();

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
        nonce: await nftmarketplace.getNonce(addr2.address),
        from: addr2.address,
        functionSignature: nftmarketplace.interface.getSighash(
          `createMarketOwnerSale(address,address,uint32)`
        ),
      };

      // Meta transaction signing
      const signature = await addr2._signTypedData(
        domain,
        types,
        MetaTransaction
      );

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const options = {
        value: price,
      };
      await expect(
        nftmarketplace
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
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if addr1 tries to createMarketOwnerSale with non whitelisted NFT contract", async () => {
      // arrange
      const [owner, addr1] = await ethers.getSigners();
      await mint(nftminter, owner.address, 1);

      // user owner allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(owner)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // set floor price & fee
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      const price = 10000;
      const txFloorPrice = await nftcontractmanager.setFloorPrice(
        nftminter.address,
        price
      );
      txFloorPrice.wait();

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
          `createMarketOwnerSale(address,address,uint32)`
        ),
      };

      // Meta transaction signing
      const signature = await owner._signTypedData(
        domain,
        types,
        MetaTransaction
      );

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const options = {
        value: price,
      };
      await expect(
        nftmarketplace
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
          )
      ).to.be.revertedWith("Contract not allowed");
    });
    it("Should revert if addr1 tries to createMarketOwnerSale with a floor price of 0", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await mint(nftminter, owner.address, 2);

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

      // set fee
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

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
          `createMarketOwnerSale(address,address,uint32)`
        ),
      };

      // Meta transaction signing
      const signature = await owner._signTypedData(
        domain,
        types,
        MetaTransaction
      );

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const options = {
        value: 10000,
      };
      await expect(
        nftmarketplace
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
          )
      ).to.be.revertedWith("Floor price must be at least 1 wei");
    });
    it("Should revert if addr1 tries to createMarketOwnerSale with msg.value != floor price", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await mint(nftminter, owner.address, 2);

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
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      const price = 10000;
      const txFloorPrice = await nftcontractmanager.setFloorPrice(
        nftminter.address,
        price
      );
      txFloorPrice.wait();

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
          `createMarketOwnerSale(address,address,uint32)`
        ),
      };

      // Meta transaction signing
      const signature = await owner._signTypedData(
        domain,
        types,
        MetaTransaction
      );

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const options = {
        value: 5000,
      };
      await expect(
        nftmarketplace
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
          )
      ).to.be.revertedWith("Asking price must be == floorPrice");
    });
    it("Should pass if addr1 successfully buys an item through CreateOwnerSale MetaTransaction", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await mint(nftminter, owner.address, 1);

      const provider = waffle.provider;

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

      // set fee and floor price
      const txFee = await nftcontractmanager.setFee(nftminter.address, 10);
      txFee.wait();

      const price = 10000;
      const txFloorPrice = await nftcontractmanager.setFloorPrice(
        nftminter.address,
        price
      );
      txFloorPrice.wait();

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
          `createMarketOwnerSale(address,address,uint32)`
        ),
      };

      // Meta transaction signing
      const signature = await owner._signTypedData(
        domain,
        types,
        MetaTransaction
      );

      const { r, s, v } = ethers.utils.splitSignature(signature);

      const ownerBalanceBefore = await provider.getBalance(owner.address);

      const options = {
        value: price,
      };
      const txMOSale = await nftmarketplace
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
      txMOSale.wait();

      const ownerBalanceAfter = await provider.getBalance(owner.address);

      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.add(price));
      expect(await nftminter.ownerOf(0)).to.equal(addr1.address);
    });
  });

  describe("transferSalesFees", () => {
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

      const price = 1000000;
      const fee =
        ((await nftcontractmanager.getFee(nftminter.address)) * price) / 100;

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter.address, 0, price);
      tx3.wait();

      // user buys MarketItem
      const options = {
        value: price,
      };
      const tx4 = await nftmarketplace
        .connect(addr2)
        .createMarketSale(nftminter.address, 0, options);
      tx4.wait();

      const ownerBalanceBefore = await provider.getBalance(owner.address);

      // owner transfer sales fees
      const txTransferSalesFees = await nftmarketplace.transferSalesFees();
      txTransferSalesFees.wait();

      const gasUsed = (
        await provider.getTransactionReceipt(txTransferSalesFees.hash)
      ).gasUsed;
      const gasFee = gasUsed.mul(GAS_PRICE);

      const ownerBalanceAfter = await provider.getBalance(owner.address);

      expect(ownerBalanceAfter).to.be.equal(
        ownerBalanceBefore.sub(gasFee).add(fee)
      );
    });
  });

  describe.only("MarketItem Enumeration", () => {
    it("Should pass if enumeration of all MarketItems for addr1 is ok", async () => {
      const [, addr1] = await ethers.getSigners();
      const qty = 3;
      await mint(nftminter, addr1.address, qty);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApprove = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApprove.wait();

      const price = 1000;
      for (let i = 0; i < qty; i++) {
        const txCreate = await nftmarketplace
          .connect(addr1)
          .createMarketItem(nftminter.address, i, price + i);
        txCreate.wait();
      }

      const userItemsCount = await nftmarketplace.getUserItemsCount(
        addr1.address
      );

      const userItems = [];
      for (let i = 0; i < userItemsCount; i++) {
        const item = await nftmarketplace.itemOfUserByIndex(addr1.address, i);
        userItems.push(item);
      }

      userItems.forEach((it, i) => {
        expect(it.seller).to.equal(addr1.address);
        expect(it.price).to.equal(price + i);
      });
    });
    it.only("Should pass if enumeration of all MarketItems is ok", async () => {
      const [, addr1, addr2] = await ethers.getSigners();
      const qty = 2;
      await mint(nftminter, addr1.address, qty);
      await mint(nftminter, addr2.address, qty);

      const txWhitelist = await nftcontractmanager.setWhitelistedNFTContract(
        nftminter.address,
        true
      );
      txWhitelist.wait();

      const txApprove = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      txApprove.wait();

      const txApprove2 = await nftminter
        .connect(addr2)
        .setApprovalForAll(nftmarketplace.address, true);
      txApprove2.wait();

      const price = 1000;
      for (let i = 0; i < qty; i++) {
        const txCreate = await nftmarketplace
          .connect(addr1)
          .createMarketItem(nftminter.address, i, price + i);
        txCreate.wait();
      }

      const price2 = 2000;
      for (let i = 2; i < qty + 2; i++) {
        const txCreate = await nftmarketplace
          .connect(addr2)
          .createMarketItem(nftminter.address, i, price2 + i);
        txCreate.wait();
      }

      const allItemsCount = await nftmarketplace.getAllItemsCount();

      const allItems = [];
      for (let i = 0; i < allItemsCount; i++) {
        const item = await nftmarketplace.itemByIndex(i);
        allItems.push(item);
      }

      for (let i = 0; i < qty; i++) {
        expect(allItems[i].seller).to.equal(addr1.address);
        expect(allItems[i].price).to.equal(price + i);
      }
      for (let i = 2; i < qty + 2; i++) {
        expect(allItems[i].seller).to.equal(addr2.address);
        expect(allItems[i].price).to.equal(price2 + i);
      }
    });
  });
});
