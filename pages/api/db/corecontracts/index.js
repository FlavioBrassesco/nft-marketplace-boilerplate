import connectDB from "middleware/connectDB";
import CoreContract from "services/models/CoreContract";

const handler = async function (req, res) {
  const { key } = req.query;
  console.log(key);
  if (req.method === "GET" && !key) {
    const contracts = await CoreContract.find({});
    return res.status(200).json(contracts);
  } else if (req.method === "GET" && key) {
    const contract = await CoreContract.findOne({ key: key }).exec();
    return res.status(200).json(contract);
  } else if (req.method === "POST") {
    const contract = new CoreContract({
      key: req.body.key,
      address: req.body.address,
    });
    const savedContract = await contract.save();
    return res.status(201).json(savedContract);
  }
};

export default connectDB(handler);
