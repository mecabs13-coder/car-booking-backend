const mongoose = require("mongoose");
require("dotenv").config();

const mongoURI = process.env.MONGODB_URL;

mongoose.connect(mongoURI);

const connection = mongoose.connection;
connection.once("open", () => {
  console.log("✅ MongoDB connection established successfully");
});