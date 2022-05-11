import connectDB from "../../../middleware/connectDB";
import Item from "../../../models/Item";

const handler = async function (req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    const item = await Item.findById(id);
    return res.status(200).json(item);
  } else if (req.method === "PUT") {
    
    const item = new Item({
      status: req.body.status,
      price: req.body.price
    });

    const updated = await Item.findByIdAndUpdate(id, item, {
      new: true,
    });
    res.status(201).json(updated);
  } else if (req.method === "DELETE") {
    await Item.findByIdAndRemove(id);
    res.status(204).end();
  }
}

export default connectDB(handler);