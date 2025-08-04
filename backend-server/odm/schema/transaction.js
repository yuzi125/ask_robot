const mongoose = require("mongoose");
const { Schema } = mongoose;

const transactionSchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
            required: true,
        },
        conversationId: {
            type: String,
            ref: "Conversation",
            index: true,
        },
        tokenType: {
            type: String,
            enum: ["prompt", "completion", "credits"],
            required: true,
        },
        model: {
            type: String,
        },
        context: {
            type: String,
        },
        valueKey: {
            type: String,
        },
        rate: Number,
        rawAmount: Number,
        tokenValue: Number,
        inputTokens: { type: Number },
        writeTokens: { type: Number },
        readTokens: { type: Number },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Transaction", transactionSchema);
