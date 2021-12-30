const hre = require("hardhat");

async function main() {
  const NFTMinter = await hre.ethers.getContractFactory("NFTMinter");
  const nftminter = await NFTMinter.deploy("NFT Project Name", "NFTPN");

  await nftminter.deployed();

  console.log("NFT Minter deployed to:", nftminter.address);

  const NFTMarket = await hre.ethers.getContractFactory("NFTMarketplace");
  const nftmarket = await NFTMarket.deploy();

  await nftmarket.deployed();

  console.log("NFTMarketplace deployed to:", nftmarket.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
