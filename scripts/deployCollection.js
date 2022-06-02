const helpers = require("../test/helpers");
require("dotenv").config();
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;

async function main() {
  for (let i = 0; i < 3; i++) {
    const nftminter = await helpers.deployMinter(
      `ERC721-${i}`,
      `ERC-${i}`,
      `https://localhost:3000/erc721-${i}.json`,
      `https://localhost:3000/img-${i}/`,
      5000,
      100000
    );
    console.log(nftminter.address);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
