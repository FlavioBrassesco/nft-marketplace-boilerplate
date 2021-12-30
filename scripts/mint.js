require("dotenv").config();

const hre = require("hardhat");
const NUM_ITEMS = 5;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
const CONTRACT_ADDRESS = process.env.MINTER_ADDRESS;

async function main() {
  const NFTMinter = await hre.ethers.getContractFactory("NFTMinter");
  const nftminter = await NFTMinter.attach(CONTRACT_ADDRESS);

  for (var i = 1; i <= NUM_ITEMS; i++) {
    await nftminter.mintItem(OWNER_ADDRESS, `your_metadata_uri`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
