const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

const ADDR_0 = "0x0000000000000000000000000000000000000000";
// Hardcoded Gas price in Ganache
const GAS_PRICE = ethers.BigNumber.from("20000000000");

describe("NFTMarketplace", () => {
  const deployMarketplace = async (name) => {
    const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    const nftmarketplace = await NFTMarketplace.deploy(name);
    await nftmarketplace.deployed();
    return nftmarketplace;
  };
  const deployMinter = async (name, symbol) => {
    const NFTMinter = await ethers.getContractFactory("NFTMinter");
    const nftminter = await NFTMinter.deploy(name, symbol);
    await nftminter.deployed();
    return nftminter;
  };
  const mint = async (nftminter, address, tokensQty) => {
    for (let i = 0; i < tokensQty; i++) {
      const tx = await nftminter.mint(address, `${i}`);
      tx.wait();
    }
  };

  describe("Ownable", () => {
    let nftmarketplace;

    before(async () => {
      nftmarketplace = await deployMarketplace("NFTMarketplace");
    });

    it("Should pass if owner is owner()", async () => {
      const [owner] = await ethers.getSigners();
      expect(await nftmarketplace.owner()).to.equal(owner.address);
    });

    it("Should pass if new owner is addr1", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const transferOwnership = await nftmarketplace.transferOwnership(
        addr1.address
      );
      transferOwnership.wait();
      expect(await nftmarketplace.owner()).to.equal(addr1.address);
    });

    it("Should revert if old owner tries to transfer ownership", async () => {
      const [owner] = await ethers.getSigners();
      await expect(
        nftmarketplace.transferOwnership(owner.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should pass if ownership is effectively renounced", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const tx = await nftmarketplace.connect(addr1).renounceOwnership();
      tx.wait();
      expect(await nftmarketplace.owner()).to.equal(ADDR_0);
    });
  });

  describe("ERC721Holder", function () {
    let nftmarketplace;

    before(async () => {
      nftmarketplace = await deployMarketplace("NFTMarketplace");
    });
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

  describe("NFT Contracts Whitelist Management", () => {
    let nftmarketplace;

    before(async () => {
      nftmarketplace = await deployMarketplace("NFTMarketplace");
    });

    it("Should return true if addr1 address is succesfully whitelisted", async () => {
      const [owner, addr1] = await ethers.getSigners();

      const addWhitelistedNFTContract =
        await nftmarketplace.addWhitelistedNFTContract(addr1.address);
      await addWhitelistedNFTContract.wait();

      expect(
        await nftmarketplace.isWhitelistedNFTContract(addr1.address)
      ).to.equal(true);
    });

    it("Should revert if calling addWhitelistedNFTContract and removeWhitelistedNFTContract from addr1", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      await expect(
        nftmarketplace.connect(addr1).addWhitelistedNFTContract(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        nftmarketplace
          .connect(addr1)
          .removeWhitelistedNFTContract(addr1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should return false if addr2 address is not whitelisted", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();
      expect(
        await nftmarketplace.isWhitelistedNFTContract(addr2.address)
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
        await nftmarketplace.removeWhitelistedNFTContract(addr1.address);
      await removeWhitelistedNFTContract.wait();

      expect(
        await nftmarketplace.isWhitelistedNFTContract(addr1.address)
      ).to.equal(false);
    });
  });

  describe("NFT Contracts fee management", function () {
    let nftmarketplace;

    before(async () => {
      nftmarketplace = await deployMarketplace("NFTMarketplace");
    });
    it("Should revert if trying to set fee for address 0", async () => {
      await expect(nftmarketplace.setFee(ADDR_0, 10)).to.be.revertedWith(
        "Can't set fee for address(0)"
      );
    });

    it("Should revert if trying to set fee higher than 5000", async () => {
      const [owner] = await ethers.getSigners();
      await expect(nftmarketplace.setFee(owner.address, 51)).to.be.revertedWith(
        "Can't set fee higher than 50.00%"
      );
    });

    it("Should pass if fee succesfully setted", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const tx = await nftmarketplace.setFee(addr1.address, 30);
      tx.wait();
      expect(await nftmarketplace.getFee(addr1.address)).to.equal(30);
    });

    it("Should revert if querying fee for address 0", async () => {
      await expect(nftmarketplace.getFee(ADDR_0)).to.be.revertedWith(
        "Can't get fee for address(0)"
      );
    });

    it("Should revert if calling functions with wrong parameters", async () => {
      const [owner] = await ethers.getSigners();
      await expect(nftmarketplace.setFee(owner.address, NaN)).to.be.reverted;
      await expect(nftmarketplace.setFee(owner.address, -1000)).to.be.reverted;
      await expect(nftmarketplace.setFee(owner.address, undefined)).to.be
        .reverted;
      await expect(nftmarketplace.setFee(owner.address, null)).to.be.reverted;
      await expect(nftmarketplace.setFee(owner.address, Infinity)).to.be
        .reverted;
    });
  });

  describe("NFT Contracts floor price management", function () {
    let nftmarketplace;

    before(async () => {
      nftmarketplace = await deployMarketplace("NFTMarketplace");
    });

    it("Should revert if trying to set floor price for address 0", async () => {
      await expect(
        nftmarketplace.setFloorPrice(ADDR_0, 1000)
      ).to.be.revertedWith("Can't set floor price for address(0)");
    });

    it("Should revert if trying to set floor price to 0", async () => {
      const [owner] = await ethers.getSigners();
      await expect(
        nftmarketplace.setFloorPrice(owner.address, 0)
      ).to.be.revertedWith("Floor price must be at least 1 wei");
    });

    it("Should pass if floor price is succesfully setted", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const tx = await nftmarketplace.setFloorPrice(addr1.address, 50000);
      tx.wait();
      expect(await nftmarketplace.getFloorPrice(addr1.address)).to.equal(50000);
    });

    it("Should revert if querying floor price for address 0", async () => {
      await expect(nftmarketplace.getFloorPrice(ADDR_0)).to.be.revertedWith(
        "Can't get floor price for address(0)"
      );
    });

    it("Should revert if calling functions with wrong parameters", async () => {
      const [owner] = await ethers.getSigners();
      await expect(nftmarketplace.setFloorPrice(owner.address, NaN)).to.be
        .reverted;
      await expect(nftmarketplace.setFloorPrice(owner.address, -1000)).to.be
        .reverted;
      await expect(nftmarketplace.setFloorPrice(owner.address, undefined)).to.be
        .reverted;
      await expect(nftmarketplace.setFloorPrice(owner.address, null)).to.be
        .reverted;
      await expect(nftmarketplace.setFloorPrice(owner.address, Infinity)).to.be
        .reverted;
    });
  });

  describe("NFTMarketplace item creation", () => {
    let nftmarketplace;
    let nftminter1;
    beforeEach(async () => {
      nftmarketplace = await deployMarketplace("NFTMarketplace");
      nftminter1 = await deployMinter("NFTMinter1", "NM1");
    });

    it("Should pass if addr1 successfully creates a MarketItem", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await mint(nftminter1, addr1.address, 2);
      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftmarketplace.addWhitelistedNFTContract(
        nftminter1.address
      );
      tx.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter1
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter1.address, 0, 10000);
      tx3.wait();

      expect(await nftmarketplace.getSellerItemsCount(addr1.address)).to.equal(
        1
      );
      expect(await nftmarketplace.getActiveItemsCount()).to.equal(1);

      // this checks for onlyNotListed modifier, should be changed for a better test
      await expect(
        nftmarketplace
          .connect(addr1)
          .createMarketItem(nftminter1.address, 0, 10000)
      ).to.be.revertedWith("Item not allowed");
    });

    it("Should pass if addr1 successfully cancels a MarketItem", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await mint(nftminter1, addr1.address, 2);
      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftmarketplace.addWhitelistedNFTContract(
        nftminter1.address
      );
      tx.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter1
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter1.address, 0, 10000);
      tx3.wait();

      expect(await nftminter1.ownerOf(0)).to.equal(nftmarketplace.address);
      expect(await nftmarketplace.getSellerItemsCount(addr1.address)).to.equal(
        1
      );
      expect(await nftmarketplace.getActiveItemsCount()).to.equal(1);

      const tx4 = await nftmarketplace
        .connect(addr1)
        .cancelMarketItem(nftminter1.address, 0);
      tx4.wait();

      expect(await nftminter1.ownerOf(0)).to.equal(addr1.address);
      expect(await nftmarketplace.getSellerItemsCount(addr1.address)).to.equal(
        0
      );
      expect(await nftmarketplace.getActiveItemsCount()).to.equal(0);
    });

    it("Should pass if addr2 successfully buys a MarketItem", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const provider = waffle.provider;

      await mint(nftminter1, addr1.address, 2);
      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftmarketplace.addWhitelistedNFTContract(
        nftminter1.address
      );
      tx.wait();

      const txFee = await nftmarketplace.setFee(nftminter1.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter1
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter1.address, 0, 10000);
      tx3.wait();

      const addr1BalanceBefore = await provider.getBalance(addr1.address);

      const options = {
        value: 10000,
      };

      const tx4 = await nftmarketplace
        .connect(addr2)
        .createMarketSale(nftminter1.address, 0, options);
      tx4.wait();

      const fee =
        ((await nftmarketplace.getFee(nftminter1.address)) * options.value) /
        100;
      const payment = options.value - fee;

      const addr1BalanceAfter = await provider.getBalance(addr1.address);

      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.add(payment));

      expect(await nftminter1.ownerOf(0)).to.equal(addr2.address);
    });

    it("Should pass if addr1 successfully buys an item through MetaTransaction", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await mint(nftminter1, owner.address, 2);
      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftmarketplace.addWhitelistedNFTContract(
        nftminter1.address
      );
      tx.wait();

      // user owner allows marketplace to operate in his behalf
      const tx2 = await nftminter1
        .connect(owner)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // set floor price & fee
      const txFee = await nftmarketplace.setFee(nftminter1.address, 10);
      txFee.wait();
      const txFloorPrice = await nftmarketplace.setFloorPrice(
        nftminter1.address,
        10000
      );
      txFloorPrice.wait();

      const options = {
        value: 10000,
      };

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
      // Testing renounceOwnership() since is the only meaningul function to call
      // that has no parameters, modifies state and isOnlyOwner
      const MetaTransaction = {
        nonce: await nftmarketplace.getNonce(owner.address),
        from: owner.address,
        functionSignature: nftmarketplace.interface.getSighash(
          `createMarketOwnerSale(address,address,uint32)`
        ),
      };

      const signature = await owner._signTypedData(
        domain,
        types,
        MetaTransaction
      );

      // saving in case you need to remember how to verify a EIP712 signature
      const expectedSignerAddress = owner.address;
      const recoveredAddress = ethers.utils.verifyTypedData(
        domain,
        types,
        MetaTransaction,
        signature
      );
      console.log(recoveredAddress === expectedSignerAddress);

      const { r, s, v } = ethers.utils.splitSignature(signature);

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
            [addr1.address, nftminter1.address, 0]
          ),
          options
        );
      txMOSale.wait();
      expect(await nftminter1.ownerOf(0)).to.equal(addr1.address);
    });

    it.only("Should pass if sales fees are ok and get successfully transferred to owner", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const provider = waffle.provider;

      await mint(nftminter1, addr1.address, 2);
      // marketplace owner adds NFT contract as whitelisted
      const tx = await nftmarketplace.addWhitelistedNFTContract(
        nftminter1.address
      );
      tx.wait();

      const txFee = await nftmarketplace.setFee(nftminter1.address, 10);
      txFee.wait();

      // user addr1 allows marketplace to operate in his behalf
      const tx2 = await nftminter1
        .connect(addr1)
        .setApprovalForAll(nftmarketplace.address, true);
      tx2.wait();

      // user creates MarketItem
      const tx3 = await nftmarketplace
        .connect(addr1)
        .createMarketItem(nftminter1.address, 0, 1000000);
      tx3.wait();

      const nftmarketplaceBalanceBefore = await provider.getBalance(
        nftmarketplace.address
      );

      const options = {
        value: 1000000,
      };

      const tx4 = await nftmarketplace
        .connect(addr2)
        .createMarketSale(nftminter1.address, 0, options);
      tx4.wait();

      const fee =
        ((await nftmarketplace.getFee(nftminter1.address)) * options.value) /
        100;

      const nftmarketplaceBalanceAfter = await provider.getBalance(
        nftmarketplace.address
      );

      expect(nftmarketplaceBalanceAfter).to.equal(
        nftmarketplaceBalanceBefore.add(fee)
      );

      const ownerBalanceBefore = await provider.getBalance(owner.address);

      console.log("balance before:", ownerBalanceBefore);

      const txTransferSalesFees = await nftmarketplace.transferSalesFees();
      txTransferSalesFees.wait();
      const gasUsed = (
        await provider.getTransactionReceipt(txTransferSalesFees.hash)
      ).gasUsed;

      const gasFee = gasUsed.mul(GAS_PRICE);

      const ownerBalanceAfter = await provider.getBalance(owner.address);

      console.log("balance after:", ownerBalanceAfter);

      expect(ownerBalanceAfter).to.be.equal(
        ownerBalanceBefore.sub(gasFee).add(fee)
      );
    });
  });
});
