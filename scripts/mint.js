const hre = require("hardhat");
const NUM_ITEMS = 5;
const OWNER_ADDRESS = "";

async function main() {
  const NFTMinter = await hre.ethers.getContractFactory("NFTMinter");
  const nftminter = await NFTMinter.attach("yourcontractaddress");

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
