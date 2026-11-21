const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true },
    mobile: { type: String, unique: true },
    password: { type: String, required: true },
    otp: { type: Number },
    otpExpiresAt: { type: Date },
    role: { type: Number, required: true, default: 3 }, // 1 -> Admin,  2 -> Driver,  3 -> Customer
    image: { type: String },
    documentImage: { type: String },
    documentNumber: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const User = mongoose.model("User", UserSchema);
module.exports = User;
