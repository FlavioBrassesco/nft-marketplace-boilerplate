require("dotenv").config();

const hre = require("hardhat");
const NUM_ITEMS = 5;
const BASE = 1;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
const CONTRACT_ADDRESS = "0x7F81f40E5a74738F9B8116066Cf2Cf563734c840";

async function main() {
  const NFTMinter = await hre.ethers.getContractFactory("MockERC721");
  const nftminter = await NFTMinter.attach(CONTRACT_ADDRESS);

  for (let i = BASE; i < BASE + NUM_ITEMS; i++) {
    await nftminter.mint(OWNER_ADDRESS, `${i}.json`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
