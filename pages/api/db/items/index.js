import connectDB from "../../../middleware/connectDB";
import connectEthers from "../../../middleware/connectEthers";
import Item from "../../../models/Item";
const { abi } = require("../../../services/blockchain/abi/erc721.json");

const handler = async function (req, res) {
  if (req.method === "GET") {
    const items = await Item.find({});
    return res.status(200).json(items);
  } else if (req.method === "POST") {
    const contract = await connectEthers(req.body.collection, abi);
    const uri = await contract.tokenURI(req.body.tokenId);

    const item = new Item({
      collection: req.body.collection,
      tokenId: req.body.tokenId,
      uri,
      status: req.body.status,
      price: req.body.price,
    });
    const savedItem = await item.save();
    return res.status(201).json(savedItem);
  }
};

export default connectDB(handler);
