const mongoose = require("mongoose");
const { Schema } = mongoose;

const balanceSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
        required: true,
    },
    // 1000 tokenCredits = 1 mill ($0.001 USD)
    tokenCredits: {
        type: Number,
        default: 0,
    },
    // Automatic refill settings
    autoRefillEnabled: {
        type: Boolean,
        default: false,
    },
    refillIntervalValue: {
        type: Number,
        default: 30,
    },
    refillIntervalUnit: {
        type: String,
        enum: ["seconds", "minutes", "hours", "days", "weeks", "months"],
        default: "days",
    },
    lastRefill: {
        type: Date,
        default: Date.now,
    },
    // amount to add on each refill
    refillAmount: {
        type: Number,
        default: 0,
    },
});

module.exports = mongoose.model("Balance", balanceSchema);
