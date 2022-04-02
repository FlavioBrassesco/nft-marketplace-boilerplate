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
const deployMetaTxRelayer = async (name) => {
  const MetaTxRelayer = await ethers.getContractFactory(
    "NativeMetaTransactionCalldata"
  );
  const metatxrelayer = await MetaTxRelayer.deploy(name);
  await metatxrelayer.deployed();
  return metatxrelayer;
};
const deployManager = async () => {
  const NFTCollectionManager = await ethers.getContractFactory(
    "NFTCollectionManager"
  );
  const nftcollectionmanager = await NFTCollectionManager.deploy();
  await nftcollectionmanager.deployed();
  return nftcollectionmanager;
};
const deployMarketplace = async (erc20address, pairaddress, manageraddress) => {
  const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
  const nftmarketplace = await NFTMarketplace.deploy(
    erc20address,
    pairaddress,
    manageraddress
  );
  await nftmarketplace.deployed();
  return nftmarketplace;
};
const deployAuctions = async (maxDays, manageraddress) => {
  const NFTAuctions = await ethers.getContractFactory("NFTAuctions");
  const nftauctions = await NFTAuctions.deploy(maxDays, manageraddress);
  await nftauctions.deployed();
  return nftauctions;
};

const deployBuyOffers = async (maxDays, manageraddress) => {
  const NFTBuyOffers = await ethers.getContractFactory("NFTBuyOffers");
  const nftbuyoffers = await NFTBuyOffers.deploy(maxDays, manageraddress);
  await nftbuyoffers.deployed();
  return nftbuyoffers;
};

const deployUniFactory = async (address) => {
  const Unifactory = await ethers.getContractFactory("MockUniFactory");
  const unifactory = await Unifactory.deploy(address);
  await unifactory.deployed();
  return unifactory;
};

const deployERC20 = async () => {
  const ERC20 = await ethers.getContractFactory("MockERC20");
  const erc20 = await ERC20.deploy();
  await erc20.deployed();
  return erc20;
};

const deployWeth = async () => {
  const Weth = await ethers.getContractFactory("MockWeth");
  const weth = await Weth.deploy();
  await weth.deployed();
  return weth;
};

module.exports.deployMinter = deployMinter;
module.exports.deployManager = deployManager;
module.exports.deployMetaTxRelayer = deployMetaTxRelayer;
module.exports.deployMarketplace = deployMarketplace;
module.exports.deployAuctions = deployAuctions;
module.exports.deployBuyOffers = deployBuyOffers;
module.exports.deployWeth = deployWeth;
module.exports.deployERC20 = deployERC20;
module.exports.deployUniFactory = deployUniFactory;
module.exports.mint = mint;
