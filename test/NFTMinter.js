const { expect } = require("chai");
const { ethers } = require("hardhat");

const BASE_URI = "https://ipfs.io/hash/";
const ADDR_0 = "0x0000000000000000000000000000000000000000";

describe("NFTMinter", function () {
  const _beforeDeploy = async () => {
    const NFTMinter = await ethers.getContractFactory("NFTMinter");
    const nftminter = await NFTMinter.deploy("NFTMinter2", "NM2");
    await nftminter.deployed();
    return nftminter;
  };
  const _beforeMint = async (nftminter, tokensQty) => {
    const [owner, addr1] = await ethers.getSigners();
    const addr1Address = await addr1.getAddress();
    for (let i = 0; i < tokensQty; i++) {
      const tx = await nftminter.mint(addr1Address, `${i}`);
      tx.wait();
    }
  };

  describe("Metadata", () => {
    let nftminter;
    before(async () => {
      nftminter = await _beforeDeploy();
      _beforeMint(nftminter, 2);
    });
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
    it("Should pass if URI for tokens is correct", async () => {
      expect(await nftminter.tokenURI(0)).to.equal(`${BASE_URI}0`);
      expect(await nftminter.tokenURI(1)).to.equal(`${BASE_URI}1`);
    });
  });

  describe("Minting", () => {
    let nftminter;
    before(async () => {
      nftminter = await _beforeDeploy();
    });
    it("Should pass if 10 tokens minted", async () => {
      const [owner, addr1] = await ethers.getSigners();

      for (let i = 0; i < 10; i++) {
        const tx = await nftminter.mint(addr1.address, `${i}`);
        tx.wait();
      }

      expect(await nftminter.balanceOf(addr1.address)).to.equal(10);
      // expect(await nftminter.totalSupply()).to.equal(10);
    });

    it("Should revert if minter is not owner and does not send msg.value", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(nftminter.connect(addr1).mint(addr1.address, "11")).to.be
        .reverted;
    });

    it("Should pass if addr1 successfully mints by sending correct msg.value", async () => {
      const [owner, addr1] = await ethers.getSigners();
      const options = {
        value: ethers.utils.parseEther("0.001"),
      };
      const tx = await nftminter
        .connect(addr1)
        .mint(addr1.address, "mintedWithValue", options);
      tx.wait();
      expect(await nftminter.balanceOf(addr1.address)).to.equal(11);
      expect(await nftminter.tokenURI(10)).to.equal(
        `${BASE_URI}mintedWithValue`
      );
    });
  });

  describe("Transferring", () => {
    let nftminter;
    before(async () => {
      nftminter = await _beforeDeploy();
      await _beforeMint(nftminter, 3);
    });

    it("Should pass if addr1 successfully safeTransfers token 0", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const tx = await nftminter
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](
          addr1.address,
          addr2.address,
          0
        );
      tx.wait();

      expect(await nftminter.ownerOf(0)).to.equal(addr2.address);
      expect(await nftminter.balanceOf(addr1.address)).to.equal(2);
      expect(await nftminter.balanceOf(addr2.address)).to.equal(1);
    });

    it("Should pass if addr1 successfully transfers token 1", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const tx = await nftminter
        .connect(addr1)
        .transferFrom(addr1.address, addr2.address, 1);
      tx.wait();

      expect(await nftminter.ownerOf(1)).to.equal(addr2.address);
      expect(await nftminter.balanceOf(addr1.address)).to.equal(1);
      expect(await nftminter.balanceOf(addr2.address)).to.equal(2);
    });

    it("Should revert if addr1 tries to transfer token 2 to address 0", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(
        nftminter.connect(addr1).transferFrom(addr1.address, ADDR_0, 2)
      ).to.be.revertedWith("ERC721: transfer to the zero address");
    });

    it("Should revert if owner tries to transfer a token from addr1", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(
        nftminter.transferFrom(addr1.address, owner.address, 2)
      ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
    });
  });

  describe("Approvals", () => {
    let nftminter;
    before(async () => {
      nftminter = await _beforeDeploy();
      await _beforeMint(nftminter, 3);
    });

    it("Should pass if addr2 is correctly approved to manage tokenId 0", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();
      const tx = await nftminter.connect(addr1).approve(addr2.address, 0);
      tx.wait();

      expect(await nftminter.getApproved(0)).to.equal(addr2.address);

      const tx2 = await nftminter
        .connect(addr2)
        .transferFrom(await addr1.getAddress(), addr2.address, 0);
      tx2.wait();

      expect(await nftminter.ownerOf(0)).to.equal(addr2.address);

      expect(await nftminter.getApproved(0)).to.equal(ADDR_0);
    });

    it("Should revert if owner tries to approve a token it doesn't own", async () => {
      const [owner] = await ethers.getSigners();
      await expect(nftminter.approve(owner.address, 1)).to.be.revertedWith(
        "ERC721: approve caller is not owner nor approved for all"
      );
    });

    it("Should revert if addr1 tries to approve addr1", async () => {
      const [owner, addr1] = await ethers.getSigners();
      await expect(nftminter.approve(addr1.address, 1)).to.be.revertedWith(
        "ERC721: approval to current owner"
      );
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
        .setApprovalForAll(owner.address, true);
      tx.wait();

      expect(
        await nftminter.isApprovedForAll(addr1.address, owner.address)
      ).to.equal(true);

      const tx2 = await nftminter.transferFrom(addr1.address, owner.address, 1);
      tx2.wait();

      const tx3 = await nftminter.transferFrom(addr1.address, owner.address, 2);
      tx3.wait();

      expect(await nftminter.ownerOf(1)).to.equal(owner.address);
      expect(await nftminter.ownerOf(2)).to.equal(owner.address);
    });
  });

  describe("ERC721Enumerable", () => {
    let nftminter;
    before(async () => {
      nftminter = await _beforeDeploy();
      await _beforeMint(nftminter, 3);
    });
    it("Should pass if tokenOfOwnerByIndex correctly lists all tokens from addr1", async () => {
      const [owner, addr1] = await ethers.getSigners();

      const balance = await nftminter.balanceOf(addr1.address);

      let tokensOfOwner = [];

      for (let i = 0; i < balance; i++) {
        tokensOfOwner.push(
          await nftminter.tokenOfOwnerByIndex(addr1.address, i)
        );
      }
      tokensOfOwner = tokensOfOwner.map((t) => {
        return t.toString();
      });

      expect(tokensOfOwner).to.have.members(["0", "1", "2"]);
    });

    it("Should pass if all tokens get listed correctly", async () => {
      const totalSupply = await nftminter.totalSupply();

      let tokens = [];

      for (let i = 0; i < totalSupply; i++) {
        tokens.push(await nftminter.tokenByIndex(i));
      }
      tokens = tokens.map((t) => {
        return t.toString();
      });

      expect(tokens).to.have.members(["0", "1", "2"]);
    });
  });

  describe.only("MetaTransactions", () => {
    let nftminter;
    before(async () => {
      nftminter = await _beforeDeploy();
      await _beforeMint(nftminter, 3);
    });

    it("Should pass if successfully minted with NativeMetaTransactionImproved", async () => {
      const [owner, addr1] = await ethers.getSigners();

      const domain = {
        name: await nftminter.name(),
        version: await nftminter.ERC712_VERSION(),
        verifyingContract: nftminter.address,
        salt: ethers.utils.hexZeroPad(
          (await nftminter.getChainId()).toHexString(),
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
        nonce: await nftminter.getNonce(owner.address),
        from: owner.address,
        functionSignature:
          nftminter.interface.getSighash(`mint(address,string)`),
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

      const tx = await nftminter
        .connect(addr1)
        ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8,bytes)"](
          MetaTransaction.from,
          MetaTransaction.functionSignature,
          r,
          s,
          v,
          ethers.utils.defaultAbiCoder.encode(
            ["address", "string"],
            [addr1.address, "NativeMetaTransactionImproved"]
          )
        );
      tx.wait();
      expect(await nftminter.balanceOf(addr1.address)).to.equal(4);
      expect(await nftminter.tokenURI(3)).to.equal(
        `${BASE_URI}NativeMetaTransactionImproved`
      );
    });

    it("Should revert if called with wrong calldata", async () => {
      const [owner, addr1] = await ethers.getSigners();

      const domain = {
        name: await nftminter.name(),
        version: await nftminter.ERC712_VERSION(),
        verifyingContract: nftminter.address,
        salt: ethers.utils.hexZeroPad(
          (await nftminter.getChainId()).toHexString(),
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
        nonce: await nftminter.getNonce(owner.address),
        from: owner.address,
        functionSignature:
          nftminter.interface.getSighash(`mint(address,string)`),
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

      await expect(
        nftminter
          .connect(addr1)
          ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8,bytes)"](
            MetaTransaction.from,
            MetaTransaction.functionSignature,
            r,
            s,
            v,
            ethers.utils.defaultAbiCoder.encode(
              ["address", "uint256"],
              [addr1.address, 1245]
            )
          )
      ).to.be.revertedWith("Function call not successful");
    });

    // testing for executeMetaTransaction with empty callData
    it("Should pass if owner successfully signed for executing renounceOwnership()", async () => {
      const [owner, addr1] = await ethers.getSigners();

      const domain = {
        name: await nftminter.name(),
        version: await nftminter.ERC712_VERSION(),
        verifyingContract: nftminter.address,
        salt: ethers.utils.hexZeroPad(
          (await nftminter.getChainId()).toHexString(),
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
        nonce: await nftminter.getNonce(owner.address),
        from: owner.address,
        functionSignature:
          nftminter.interface.getSighash(`renounceOwnership()`),
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

      const tx = await nftminter
        .connect(addr1)
        ["executeMetaTransaction(address,bytes,bytes32,bytes32,uint8)"](
          MetaTransaction.from,
          MetaTransaction.functionSignature,
          r,
          s,
          v
        );
      tx.wait();
      expect(await nftminter.owner()).to.equal(ADDR_0);

      // saving this if you need to test a function that returns a value, such as totalSupply()
      // which has no point signing other than checking that executeMetaTransaction works
      // expect(ethers.utils.defaultAbiCoder.decode(["uint"], tx)[0]).to.equal(3);
    });
  });
});
