import connectDB from "@middleware/connectDB";
import connectEthers from "@middleware/connectEthers"
import Collection from "@services/database/models/Collection";
const { abi } = require("@services/blockchain/abi/erc721.json");

const handler = async function (req, res) {
  if (req.method === "GET") {
    const collections = await Collection.find({});
    return res.status(200).json(collections);
  } else if (req.method === "POST") {

    const contract = await connectEthers(req.body.address, abi);
    const uri = await contract.contractURI();

    const collection = new Collection({
      address: req.body.address,
      uri,
      sales: 0
    });
    const savedCollection = await collection.save();
    return res.status(201).json(savedCollection);
  }
}

export default connectDB(handler);