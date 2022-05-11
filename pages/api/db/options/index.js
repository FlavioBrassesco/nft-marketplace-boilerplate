import connectDB from "../../../../../middleware/connectDB";
import Option from "../../../../../models/Option";

const handler = async function (req, res) {
  if (req.method === "GET") {
    const options = await Option.find({});
    return res.status(200).json(options);
  } else if (req.method === "POST") {
    const option = new Option({
      key: req.body.key,
      value: req.body.value,
    });
    const savedOption = await option.save();
    return res.status(201).json(savedOption);
  }
}

export default connectDB(handler);