const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const {
  deployMinter,
  mint,
  deployMarketplace,
  deployManager,
  deployMetaTxRelayer,
  deployUniFactory,
  deployERC20,
  deployWeth,
} = require("./helpers");

const ADDR_0 = "0x0000000000000000000000000000000000000000";
// Hardcoded Gas price in Ganache
const GAS_PRICE = ethers.BigNumber.from("20000000000");

describe("NFTMarketplace", () => {
  let nftmarketplace;
  let nftminter;
  let nftcollectionmanager;
  let metatxrelayer;
  let owner, addr1, addr2, erc20, weth, unifactory, pairAddress;
  before(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    erc20 = await deployERC20();
    weth = await deployWeth();
    unifactory = await deployUniFactory(owner.address);
    metatxrelayer = await deployMetaTxRelayer("Meta");

    const transactionHash = await owner.sendTransaction({
      to: addr1.address,
      value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
    });

    const txWeth = await weth
      .connect(owner)
      .deposit({ value: ethers.utils.parseEther("5.0") });
    txWeth.wait();
    const txErc20 = await erc20
      .connect(owner)
      .transfer(unifactory.address, ethers.utils.parseEther("2.0"));
    txErc20.wait();
    const txWeth2 = await weth
      .connect(owner)
      .transfer(unifactory.address, ethers.utils.parseEther("5.0"));
    txWeth2.wait();
    pairAddress = await unifactory.callStatic.createPair(
      weth.address,
      erc20.address
    );
    console.log(pairAddress);
    const txPair = await unifactory.createPair(weth.address, erc20.address);
    txPair.wait();
  });

  beforeEach(async () => {
    nftcollectionmanager = await deployManager();
    nftmarketplace = await deployMarketplace(
      erc20.address,
      pairAddress,
      nftcollectionmanager.address
    );
    nftminter = await deployMinter("NFTMinter", "NM1", "", "", 1000, 1000);
  });

  describe("ERC20", function () {
    it("Should return token price", async () => {
      console.log(
        await nftmarketplace.getTokenPrice(
          pairAddress,
          ethers.utils.parseEther("1")
        )
      );
      await expect(
        nftmarketplace.getTokenPrice(pairAddress, ethers.utils.parseEther("1"))
      ).to.equal((1 * 5 * 10 ** 18) / 2);
    });
  });

  describe("ERC721Holder", function () {
    it("Should pass if IERC721Receiver is implemented", async () => {
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
    it("Should revert if panic switch true", async () => {
      const txPanic = await nftmarketplace.setPanicSwitch(true);
      txPanic.wait();

      await expect(
        nftmarketplace
          .connect(addr1)
          .createMarketItem(nftminter.address, 0, 10000)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should revert if addr1 tries to create an MarketItem for a non whitelisted contract", async () => {
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
      ).to.be.revertedWith("Contract is not whitelisted");
    });

    it("Should revert if addr1 tries to create a MarketItem with price 0", async () => {
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.isWhitelistedCollection(
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
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.isWhitelistedCollection(
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

      expect(
        await nftmarketplace.getUserItemsCount(addr1.address, nftminter.address)
      ).to.equal(1);
      expect(await nftmarketplace.getAllItemsCount(nftminter.address)).to.equal(
        1
      );
      expect(await nftminter.ownerOf(0)).to.equal(nftmarketplace.address);
    });
  });

  describe("updateMarketItem", () => {
    it("Should revert if addr1 tries to update a MarketItem", async () => {
      await expect(
        nftmarketplace
          .connect(addr1)
          .updateMarketItem(nftminter.address, 0, 10000)
      ).to.be.revertedWith("Only seller allowed");
    });
    it("Should revert if addr1 tries to update a MarketItem with price 0", async () => {
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
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

      await expect(
        nftmarketplace.connect(addr1).updateMarketItem(nftminter.address, 0, 0)
      ).to.be.revertedWith("Price must be at least 1 wei");
    });
    it("Should pass if addr1 successfully updates a MarketItem", async () => {
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
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

      const tx4 = await nftmarketplace
        .connect(addr1)
        .updateMarketItem(nftminter.address, 0, 20000);
      tx4.wait();

      expect(
        (
          await nftmarketplace.itemOfUserByIndex(
            addr1.address,
            nftminter.address,
            0
          )
        ).price
      ).to.equal(20000);
    });
  });

  describe("cancelMarketItem", () => {
    it("Should revert if addr2 tries to cancel a MarketItem of addr1", async () => {
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
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
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
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
      expect(
        await nftmarketplace.getUserItemsCount(addr1.address, nftminter.address)
      ).to.equal(0);
      expect(await nftmarketplace.getAllItemsCount(nftminter.address)).to.equal(
        0
      );
    });
  });

  describe.only("buy", () => {
    it("Should revert if panic switch true", async () => {
      const txPanic = await nftmarketplace.setPanicSwitch(true);
      txPanic.wait();

      await expect(
        nftmarketplace
          .connect(addr1)
          ["buy(address,uint256)"](nftminter.address, 0, { value: 10000 })
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should revert if addr2 tries to buy with msg.value != price", async () => {
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
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
          ["buy(address,uint256)"](nftminter.address, 0, options)
      ).to.be.revertedWith("msg.value is not == Asking price");
    });

    it("Should revert if addr2 tries to buy a Market Item that is not for sale", async () => {
      await mint(nftminter, addr1.address, 1);
      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcollectionmanager.setFloorPrice(
        nftminter.address,
        10000
      );
      txFee.wait();

      await expect(
        nftmarketplace
          .connect(addr2)
          ["buy(address,uint256)"](nftminter.address, 0, {
            value: 10000,
          })
      ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
    });

    it("Should revert if addr1 tries to buy his own MarketItem", async () => {
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
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
          ["buy(address,uint256)"](nftminter.address, 0, options)
      ).to.be.revertedWith("Seller not allowed");
    });

    it("Should pass if addr2 successfully buys a MarketItem", async () => {
      const provider = waffle.provider;

      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
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

      const [addr1BalanceBefore] = await nftmarketplace.getUserPendingRevenue(
        addr1.address
      );
      const nftmarketplaceBalanceBefore = await provider.getBalance(
        nftmarketplace.address
      );

      const options = {
        value: price,
      };
      // user buys market item
      const tx4 = await nftmarketplace
        .connect(addr2)
        ["buy(address,uint256)"](nftminter.address, 0, options);
      tx4.wait();

      const [addr1BalanceAfter] = await nftmarketplace.getUserPendingRevenue(
        addr1.address
      );
      const nftmarketplaceBalanceAfter = await provider.getBalance(
        nftmarketplace.address
      );

      // calculating secondary sales fee
      const fee =
        ((await nftcollectionmanager.getFee(nftminter.address)) * price) / 100;
      const payment = price - fee;

      // checking that transfer was successful
      expect(await nftminter.ownerOf(0)).to.equal(addr2.address);
      // checking that payment was correct
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.add(payment));
      expect(nftmarketplaceBalanceAfter).to.equal(
        nftmarketplaceBalanceBefore.add(price)
      );
    });
  });

  describe("buyWithERC20", () => {
    it("Should revert if panic switch true", async () => {
      const txPanic = await nftmarketplace.setPanicSwitch(true);
      txPanic.wait();

      await expect(
        nftmarketplace.connect(addr1).buyWithERC20(nftminter.address, 0, 10000)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should revert if addr2 tries to buy with amount != price", async () => {
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
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

      await expect(
        nftmarketplace.connect(addr2).buyWithERC20(nftminter.address, 0, 10000)
      ).to.be.revertedWith("Price doesn't match item price");
    });

    it("Should revert if addr2 tries to buy a Market Item that is not for sale", async () => {
      await mint(nftminter, addr1.address, 1);
      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcollectionmanager.setFloorPrice(
        nftminter.address,
        10000
      );
      txFee.wait();

      await expect(
        nftmarketplace.connect(addr2).buyWithERC20(nftminter.address, 0, 10000)
      ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
    });

    it("Should revert if addr1 tries to buy his own MarketItem", async () => {
      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
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

      await expect(
        nftmarketplace.connect(addr1).buyWithERC20(nftminter.address, 0, 10000)
      ).to.be.revertedWith("Seller not allowed");
    });

    it("Should pass if addr2 successfully buys a MarketItem", async () => {
      const provider = waffle.provider;

      await mint(nftminter, addr1.address, 1);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.setWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets secondary sales fee to 10%
      const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
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

      const [addr1BalanceBefore] = await nftmarketplace.getUserPendingRevenue(
        addr1.address
      );
      const nftmarketplaceBalanceBefore = await provider.getBalance(
        nftmarketplace.address
      );

      const options = {
        value: price,
      };
      // user buys market item
      const tx4 = await nftmarketplace
        .connect(addr2)
        .buyWithERC20(nftminter.address, 0, 10000);
      tx4.wait();

      const [addr1BalanceAfter] = await nftmarketplace.getUserPendingRevenue(
        addr1.address
      );
      const nftmarketplaceBalanceAfter = await provider.getBalance(
        nftmarketplace.address
      );

      // calculating secondary sales fee
      const fee =
        ((await nftcollectionmanager.getFee(nftminter.address)) * price) / 100;
      const payment = price - fee;

      // checking that transfer was successful
      expect(await nftminter.ownerOf(0)).to.equal(addr2.address);
      // checking that payment was correct
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.add(payment));
      expect(nftmarketplaceBalanceAfter).to.equal(
        nftmarketplaceBalanceBefore.add(price)
      );
    });
  });

  describe("transferSalesFees", () => {
    it("Should revert if transferSalesFees is not called by owner", async () => {
      await expect(
        nftmarketplace.connect(addr1).transferSalesFees()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should pass if sales fees are ok and get successfully transferred to owner", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const provider = waffle.provider;

      await mint(nftminter, addr1.address, 2);

      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftcollectionmanager.isWhitelistedCollection(
        nftminter.address,
        true
      );
      tx.wait();

      // marketplace owner sets fee
      const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      const price = 1000000;
      const fee =
        ((await nftcollectionmanager.getFee(nftminter.address)) * price) / 100;

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
        ["buy(address,uint256)"](nftminter.address, 0, options);
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

  describe("MarketItem Enumeration", () => {
    it("Should pass if enumeration of all MarketItems for addr1 is ok", async () => {
      const qty = 3;
      await mint(nftminter, addr1.address, qty);

      const txWhitelist = await nftcollectionmanager.isWhitelistedCollection(
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
        addr1.address,
        nftminter.address
      );

      const userItems = [];
      for (let i = 0; i < userItemsCount; i++) {
        const item = await nftmarketplace.itemOfUserByIndex(
          addr1.address,
          nftminter.address,
          i
        );
        userItems.push(item);
      }

      userItems.forEach((it, i) => {
        expect(it.seller).to.equal(addr1.address);
        expect(it.price).to.equal(price + i);
      });
    });

    it("Should pass if enumeration of all MarketItems is ok", async () => {
      const qty = 2;
      await mint(nftminter, addr1.address, qty);
      await mint(nftminter, addr2.address, qty);

      const txWhitelist = await nftcollectionmanager.isWhitelistedCollection(
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

      const allItemsCount = await nftmarketplace.getAllItemsCount(
        nftminter.address
      );

      const allItems = [];
      for (let i = 0; i < allItemsCount; i++) {
        const item = await nftmarketplace.itemByIndex(nftminter.address, i);
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
