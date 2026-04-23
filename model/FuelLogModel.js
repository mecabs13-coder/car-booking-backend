const { default: mongoose } = require("mongoose");

const FuelLogSchema = new mongoose.Schema({
    carId: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    odometerImage: { type: String, required: true },
    odometerReading: { type: Number, required: true },
    fuelBillImage: { type: String, required: true },
    fuelAmountLiter: { type: Number, required: true },
    fuelCost: { type: Number },
    fuelDate: { type: Date, default: Date.now }
}, { timestamps: true });

const FuelLog = mongoose.model("FuelLog", FuelLogSchema);
module.exports = FuelLog;