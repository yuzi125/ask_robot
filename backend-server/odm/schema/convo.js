const mongoose = require("mongoose");
const { Schema } = mongoose;
const { conversationPreset } = require("./defaults");

const convoSchema = new Schema(
    {
        conversationId: {
            type: String,
            unique: true,
            required: true,
            index: true,
            meiliIndex: true,
        },
        title: {
            type: String,
            default: "New Chat",
            meiliIndex: true,
        },
        user: {
            type: String,
            index: true,
        },
        messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
        agentOptions: {
            type: mongoose.Schema.Types.Mixed,
        },
        ...conversationPreset,
        agent_id: {
            type: String,
        },
        tags: {
            type: [String],
            default: [],
            meiliIndex: true,
        },
        files: {
            type: [String],
        },
        expiredAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

convoSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });
convoSchema.index({ createdAt: 1, updatedAt: 1 });
convoSchema.index({ conversationId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Conversation", convoSchema);
