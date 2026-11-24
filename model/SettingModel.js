const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema(
  {
    contactNo1: { type: String },
    contactNo2: { type: String },
    email: { type: String },
    address: { type: String },
    logo: { type: String },
    favicon: { type: String },
    Instagram: { type: String },
    facebook: { type: String },
    WhatsApp: { type: String },
  },
  {
    timestamps: true,
  }
);

const Setting = mongoose.model("Setting", SettingSchema);
module.exports = Setting;