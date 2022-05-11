import connectDB from "../../../../middleware/connectDB";
import CoreContract from "../../../../models/CoreContract";

const handler = async function (req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    const contract = await CoreContract.findById(id);
    return res.status(200).json(contract);
  } else if (req.method === "PUT") {
    const contract = {
      address: req.body.address,
    };
    const updated = await CoreContract.findByIdAndUpdate(id, contract, {
      new: true,
    });
    res.status(201).json(updated);
  } else if (req.method === "DELETE") {
    await CoreContract.findByIdAndRemove(id);
    res.status(204).end();
  }
}

export default connectDB(handler);