const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    minlength: 3,
  },
  value: {
    type: String,
    required: true
  },
});

optionSchema.set("toJSON", {
  transform: (document, obj) => {
    obj.id = obj._id.toString();
    delete obj._id;
    delete obj.__v;
  },
});

global.Option = global.Option || mongoose.model("Option", optionSchema);
module.exports = global.Option;
