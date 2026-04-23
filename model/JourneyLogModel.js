const { default: mongoose } = require("mongoose");

const JourneyLogSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    start: {
        odometerImage: { type: String, required: true },
        odometerReading: { type: Number, required: true },
        recordedAt: { type: Date, default: Date.now }
    },
    end: {
        odometerImage: { type: String },
        odometerReading: { type: Number },
        recordedAt: { type: Date }
    },
    isCompleted: { type: Boolean, default: false }
}, { timestamps: true });

const JourneyLog = mongoose.model("JourneyLog", JourneyLogSchema);
module.exports = JourneyLog;