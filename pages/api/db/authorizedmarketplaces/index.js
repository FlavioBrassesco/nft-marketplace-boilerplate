import connectDB from "middleware/connectDB";
import AuthorizedMarketplace from "services/models/AuthorizedMarketplace";

const handler = async function (req, res) {
  if (req.method === "GET") {
    const contracts = await AuthorizedMarketplace.find({});
    return res.status(200).json(contracts);
  } else if (req.method === "POST") {
    const contract = new AuthorizedMarketplace({
      name: req.body.name,
      address: req.body.address,
    });
    const savedContract = await contract.save();
    return res.status(201).json(savedContract);
  }
}

export default connectDB(handler);