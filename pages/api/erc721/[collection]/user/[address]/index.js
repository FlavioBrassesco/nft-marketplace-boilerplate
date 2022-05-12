import connectEthers from "@middleware/connectEthers";
const { abi } = require("@services/blockchain/abi/erc721.json");

export default async function handler(req, res) {
  const { collection, address } = req.query;

  const contract = connectEthers(collection, abi)
  return res.status(200).json({
    address,
    balanceOf: await contract.balanceOf(address),
  });
}
