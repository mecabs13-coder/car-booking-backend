const { default: mongoose } = require("mongoose");

const CarSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String },
    company: { type: String },
    model: { type: String },
    carNumber : { type: String },
    fuelType: { type: String, enum: ["Petrol", "Diesel", "CNG", "Electric"] },
    personSeating: { type: Number },
    // pricePerHour: { type: Number, required: true },

    // driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    currentOdometer: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const Car = mongoose.model("Car", CarSchema);
module.exports = Car;