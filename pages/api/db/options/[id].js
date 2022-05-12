import connectDB from "@middleware/connectDB";
import Option from "@services/database/models/Option";

const handler = async function (req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    const option = await Option.findById(id);
    return res.status(200).json(option);
  } else if (req.method === "PUT") {
    const option = {
      value: req.body.value,
    };
    const updated = await Option.findByIdAndUpdate(id, option, {
      new: true,
    });
    res.status(201).json(updated);
  } else if (req.method === "DELETE") {
    await Option.findByIdAndRemove(id);
    res.status(204).end();
  }
}

export default connectDB(handler);