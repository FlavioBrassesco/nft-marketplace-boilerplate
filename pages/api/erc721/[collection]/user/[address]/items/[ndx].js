import connectEthers from "../../../../../../middleware/connectEthers";
const { abi } = require("../../../../../../services/blockchain/abi/erc721.json");

export default async function handler(req, res) {
  const { collection, address, ndx } = req.query;
  const contract = connectEthers(collection, abi);

  const id = await contract.tokenOfOwnerByIndex(address, ndx);
  const tokenURI = await contract.tokenURI(id);
  return res.status(200).json({
    id,
    tokenURI,
    owner: address,
  });
}
