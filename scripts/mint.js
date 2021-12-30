require("dotenv").config();

const hre = require("hardhat");
const NUM_ITEMS = 5;
const BASE = 1;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
const CONTRACT_ADDRESS = process.env.MINTER_ADDRESS;
const METADATA_URI = process.env.METADATA_URI;

async function main() {
  const NFTMinter = await hre.ethers.getContractFactory("NFTMinter");
  const nftminter = await NFTMinter.attach(CONTRACT_ADDRESS);

  for (var i = BASE; i < BASE + NUM_ITEMS; i++) {
    await nftminter.mintItem(OWNER_ADDRESS, `${METADATA_URI}/${i}.json`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
