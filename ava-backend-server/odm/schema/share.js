const mongoose = require("mongoose");
const { Schema } = mongoose;

const shareSchema = new Schema(
    {
        conversationId: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            index: true,
        },
        user: {
            type: String,
            index: true,
        },
        messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
        shareId: {
            type: String,
            index: true,
        },
        isPublic: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Share", shareSchema, "sharedlinks");
