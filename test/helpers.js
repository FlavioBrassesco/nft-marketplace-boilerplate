const { ethers } = require("hardhat");

const deployMinter = async (
  name,
  symbol,
  contractURI,
  baseURI,
  maxSupply,
  floorPrice
) => {
  const NFTMinter = await ethers.getContractFactory("NFTMinter");
  const nftminter = await NFTMinter.deploy(
    name,
    symbol,
    contractURI,
    baseURI,
    maxSupply,
    floorPrice
  );
  await nftminter.deployed();
  return nftminter;
};
const mint = async (nftminter, address, tokensQty) => {
  for (let i = 0; i < tokensQty; i++) {
    const tx = await nftminter.mint(address, `${i}`);
    tx.wait();
  }
};
const deployManager = async () => {
  const NFTContractManager = await ethers.getContractFactory(
    "NFTMarketplaceContractManager"
  );
  const nftcontractmanager = await NFTContractManager.deploy();
  await nftcontractmanager.deployed();
  return nftcontractmanager;
};
const deployMarketplace = async (name) => {
  const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
  const nftmarketplace = await NFTMarketplace.deploy(name);
  await nftmarketplace.deployed();
  return nftmarketplace;
};
const deployMarketplaceAuctions = async (name, maxDays) => {
  const NFTMarketplace = await ethers.getContractFactory(
    "NFTMarketplaceAuctions"
  );
  const nftmarketplace = await NFTMarketplace.deploy(name, maxDays);
  await nftmarketplace.deployed();
  return nftmarketplace;
};

const deployMarketplaceBuyOffers = async (name, maxDays) => {
  const NFTMarketplace = await ethers.getContractFactory(
    "NFTMarketplaceBuyOffers"
  );
  const nftmarketplace = await NFTMarketplace.deploy(name, maxDays);
  await nftmarketplace.deployed();
  return nftmarketplace;
};

module.exports.deployMinter = deployMinter;
module.exports.deployManager = deployManager;
module.exports.deployMarketplace = deployMarketplace;
module.exports.deployMarketplaceAuctions = deployMarketplaceAuctions;
module.exports.deployMarketplaceBuyOffers = deployMarketplaceBuyOffers;
module.exports.mint = mint;
