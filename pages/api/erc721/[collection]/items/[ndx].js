import connectEthers from "middleware/connectEthers";
const { abi } = require("services/abi/MockERC721.json");

export default async function handler(req, res) {
  const { collection, ndx } = req.query;
  const contract = connectEthers(collection, abi);

  const id = await contract.tokenByIndex(ndx);
  const owner = await contract.ownerOf(id);
  const tokenURI = await contract.tokenURI(id);
  return res.status(200).json({
    id,
    tokenURI,
    owner,
  });
}
