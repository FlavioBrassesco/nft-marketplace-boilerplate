import { ethers } from "ethers";
import connectEthers from "middleware/connectEthers";
const { abi } = require("services/abi/MockERC721.json");

export default async function handler(req, res) {
  const { collection } = req.query;
  const contract = connectEthers(collection, abi);

  const totalSupply = (await contract.totalSupply()).toNumber();
  const tokenIds = await Promise.all(
    [...Array(totalSupply)].map(async (a, i) => await contract.tokenByIndex(i))
  );

  const tokens = await Promise.all(
    tokenIds.map(async (id) => {
      return {
        id: ethers.BigNumber.from(id),
        tokenURI: await contract.tokenURI(id),
        owner: await contract.ownerOf(id),
      };
    })
  );

  return res.status(200).json(tokens);
}
