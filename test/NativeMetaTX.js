const makeSignature = async (signer) => {
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
    nonce: await nftmarketplace.getNonce(signer.address),
    from: signer.address,
    functionSignature: nftmarketplace.interface.getSighash(
      `createMarketOwnerSale(address,address,uint256)`
    ),
  };

  // Meta transaction signing
  const signature = await signer._signTypedData(domain, types, MetaTransaction);

  return [signature, MetaTransaction];
};

describe("", () => {
  it("Should revert if panic switch true", async () => {
    const txPanic = await nftmarketplace.setPanicSwitch(true);
    txPanic.wait();

    await expect(
      nftmarketplace.createMarketOwnerSale(
        addr1.address,
        nftminter.address,
        0,
        {
          value: 10000,
        }
      )
    ).to.be.revertedWith("Something went wrong");
  });

  it("Should pass if addr2 tries to sign a createOwnerSale MetaTransaction", async () => {
    // marketplace owner adds NFT contract as whitelisted
    const tx = await nftcollectionmanager.isWhitelistedCollection(
      nftminter.address,
      true
    );
    tx.wait();

    // set fee and floor price
    const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
    txFee.wait();

    const price = 10000;
    const txFloorPrice = await nftcollectionmanager.setFloorPrice(
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
      nftmarketplace
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

  it("Should revert if addr1 tries to createMarketOwnerSale with non whitelisted NFT contract", async () => {
    await mint(nftminter, owner.address, 1);

    // user owner allows marketplace to operate in his behalf
    const tx2 = await nftminter
      .connect(owner)
      .setApprovalForAll(nftmarketplace.address, true);
    tx2.wait();

    const [signature, MetaTransaction] = await makeSignature(owner);

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
            ["address", "address", "uint256"],
            [addr1.address, nftminter.address, 0]
          ),
          options
        )
    ).to.be.revertedWith("Contract is not whitelisted");
  });

  it("Should revert if addr1 tries to createMarketOwnerSale with a floor price of 0", async () => {
    await mint(nftminter, owner.address, 2);

    // marketplace owner adds NFT contract as whitelisted
    const tx = await nftcollectionmanager.isWhitelistedCollection(
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
    const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
    txFee.wait();

    const [signature, MetaTransaction] = await makeSignature(owner);

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
            ["address", "address", "uint256"],
            [addr1.address, nftminter.address, 0]
          ),
          options
        )
    ).to.be.revertedWith("Floor price must be at least 1 wei");
  });

  it("Should revert if addr1 tries to createMarketOwnerSale with msg.value != floor price", async () => {
    await mint(nftminter, owner.address, 2);

    // marketplace owner adds NFT contract as whitelisted
    const tx = await nftcollectionmanager.isWhitelistedCollection(
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
    const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
    txFee.wait();

    const price = 10000;
    const txFloorPrice = await nftcollectionmanager.setFloorPrice(
      nftminter.address,
      price
    );
    txFloorPrice.wait();

    const [signature, MetaTransaction] = await makeSignature(owner);

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
            ["address", "address", "uint256"],
            [addr1.address, nftminter.address, 0]
          ),
          options
        )
    ).to.be.revertedWith("Asking price must be == floorPrice");
  });

  it("Should pass if addr1 successfully buys an item through CreateOwnerSale MetaTransaction", async () => {
    await mint(nftminter, owner.address, 1);

    const provider = waffle.provider;

    // marketplace owner adds NFT contract as whitelisted
    const tx = await nftcollectionmanager.isWhitelistedCollection(
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
    const txFee = await nftcollectionmanager.setFee(nftminter.address, 10);
    txFee.wait();

    const price = 10000;
    const txFloorPrice = await nftcollectionmanager.setFloorPrice(
      nftminter.address,
      price
    );
    txFloorPrice.wait();

    const [signature, MetaTransaction] = await makeSignature(owner);

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
          ["address", "address", "uint256"],
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
