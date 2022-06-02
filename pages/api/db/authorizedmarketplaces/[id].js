import connectDB from "@middleware/connectDB";
import AuthorizedMarketplace from "@services/database/models/AuthorizedMarketplace";

const handler = async function (req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    const contract = await AuthorizedMarketplace.findById(id);
    return res.status(200).json(contract);
  } else if (req.method === "PUT") {
    const contract = {
      name: req.body.name
    };
    const updated = await AuthorizedMarketplace.findByIdAndUpdate(id, contract, {
      new: true,
    });
    res.status(201).json(updated);
  } else if (req.method === "DELETE") {
    await AuthorizedMarketplace.findByIdAndRemove(id);
    res.status(204).end();
  }
};

export default connectDB(handler);
