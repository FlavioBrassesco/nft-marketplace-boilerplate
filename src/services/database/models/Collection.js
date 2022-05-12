const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    minlength: 42,
    maxlength: 42,
  },
  uri: {
    type: String,
    required: true
  },
  sales: {
    type: Number
  },
  volume: {
    type: String
  },
  supply: {
    type: String
  },
  items: {
    type: Number
  }
});

collectionSchema.set("toJSON", {
  transform: (document, obj) => {
    obj.id = obj._id.toString();
    delete obj._id;
    delete obj.__v;
  },
});

global.Collection = global.Collection || mongoose.model("Collection", collectionSchema);
module.exports = global.Collection;
