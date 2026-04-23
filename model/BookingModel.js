const { default: mongoose } = require("mongoose");

const BookingSchema = new mongoose.Schema({
    carId: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bookingNumber: { type: String, unique: true },
    fromLocation: { type: String, required: true },
    toLocation: { type: String, required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    totalHours: { type: Number },
    // totalAmount: { type: Number },
    status: { type: String, enum: ["Booked", "Cancelled"], default: "Booked" },
    journeyStatus: { type: String, enum: ["Not-Started", "On-Going", "Completed"], default: "Not-Started" },
    isJourneyComplete: { type: Boolean, default: false }
}, { timestamps: true });


BookingSchema.pre("save", async function () {
    if (!this.bookingNumber) {

        const today = new Date();
        const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");

        // Count today's bookings
        const count = await mongoose.model("Booking").countDocuments({
            createdAt: {
                $gte: new Date(today.setHours(0, 0, 0, 0)),
                $lte: new Date(today.setHours(23, 59, 59, 999))
            }
        });

        const sequence = String(count + 1).padStart(4, "0");

        this.bookingNumber = `CB-${datePart}-${sequence}`;
    }
});

const Booking = mongoose.model("Booking", BookingSchema);
module.exports = Booking