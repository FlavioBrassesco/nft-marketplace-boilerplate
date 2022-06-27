import connectDB from "middleware/connectDB";
import connectEthers from "middleware/connectEthers"
import Collection from "services/models/Collection";
const { abi } = require("services/abi/MockERC721.json");

const handler = async function (req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    const collection = await Collection.findById(id);
    return res.status(200).json(collection);
  } else if (req.method === "PUT") {

    const contract = await connectEthers(req.body.address, abi);
    const uri = await contract.contractURI();

    const collection = {
      address: req.body.address,
      uri,
      sales: 0
    };
    const updated = await Collection.findByIdAndUpdate(id, collection, {
      new: true,
    });
    res.status(201).json(updated);
  } else if (req.method === "DELETE") {
    await Collection.findByIdAndRemove(id);
    res.status(204).end();
  }
}

export default connectDB(handler);