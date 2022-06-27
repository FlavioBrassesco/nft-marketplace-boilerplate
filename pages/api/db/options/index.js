import connectDB from "middleware/connectDB";
import SiteOptions from "services/models/SiteOptions";

const handler = async function (req, res) {
  if (req.method === "GET") {
    const p = new Promise((resolve, reject) => {
      SiteOptions.getSingleton((err, siteoptions) => {
        if (err) reject(err);
        resolve(siteoptions);
      });
    });

    return p
      .then((o) => res.status(200).json(o))
      .catch((e) => res.status(500).json({ error: e }));

  } else if (req.method === "POST" || req.method === "PUT") {
    if (!req.body.updated) return res.status(304).end();

    const p = new Promise((resolve, reject) => {
      SiteOptions.getSingleton((err, siteoptions) => {
        if (err) reject(err);
        siteoptions.options = req.body.options;
        siteoptions.terms = req.body.terms;
        siteoptions.socialLinks = req.body.socialLinks;
        siteoptions.save((e, options) => {
          if (e) reject(e);
          resolve(siteoptions);
        });
      });
    });

    return p
      .then((s) => res.status(200).json(s))
      .catch((e) => res.status(500).json({ error: e }));

  } else if (req.method === "DELETE") {
    return res.status(501).end();
  }
};

export default connectDB(handler);
