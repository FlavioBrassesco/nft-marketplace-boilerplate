import connect from "../contract-connection";
const contract = connect();

export default async function handler(req, res) {
  return res.status(404).json({ error: "no address specified" });
}
