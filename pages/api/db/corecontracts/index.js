import connectDB from "@middleware/connectDB";
import CoreContract from "@services/database/models/CoreContract";

const handler = async function (req, res) {
  if (req.method === "GET") {
    const contracts = await CoreContract.find({});
    return res.status(200).json(contracts);
  } else if (req.method === "POST") {
    const contract = new CoreContract({
      key: req.body.key,
      address: req.body.address,
    });
    const savedContract = await contract.save();
    return res.status(201).json(savedContract);
  }
}

export default connectDB(handler);