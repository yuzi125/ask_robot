const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema(
    {
        messageId: {
            type: String,
            unique: true,
            required: true,
            index: true,
            meiliIndex: true,
        },
        conversationId: {
            type: String,
            index: true,
            required: true,
            meiliIndex: true,
        },
        user: {
            type: String,
            index: true,
            required: true,
            default: null,
        },
        model: {
            type: String,
            default: null,
        },
        endpoint: {
            type: String,
        },
        conversationSignature: {
            type: String,
        },
        clientId: {
            type: String,
        },
        invocationId: {
            type: Number,
        },
        parentMessageId: {
            type: String,
        },
        tokenCount: {
            type: Number,
        },
        summaryTokenCount: {
            type: Number,
        },
        sender: {
            type: String,
            meiliIndex: true,
        },
        text: {
            type: String,
            meiliIndex: true,
        },
        summary: {
            type: String,
        },
        isCreatedByUser: {
            type: Boolean,
            required: true,
            default: false,
        },
        unfinished: {
            type: Boolean,
            default: false,
        },
        error: {
            type: Boolean,
            default: false,
        },
        finish_reason: {
            type: String,
        },
        _meiliIndex: {
            type: Boolean,
            required: false,
            select: false,
            default: false,
        },
        files: { type: [{ type: mongoose.Schema.Types.Mixed }], default: undefined },
        plugin: {
            type: {
                latest: {
                    type: String,
                    required: false,
                },
                inputs: {
                    type: [mongoose.Schema.Types.Mixed],
                    required: false,
                    default: undefined,
                },
                outputs: {
                    type: String,
                    required: false,
                },
            },
            default: undefined,
        },
        plugins: { type: [{ type: mongoose.Schema.Types.Mixed }], default: undefined },
        content: {
            type: [{ type: mongoose.Schema.Types.Mixed }],
            default: undefined,
            meiliIndex: true,
        },
        thread_id: {
            type: String,
        },
        iconURL: {
            type: String,
        },
        attachments: { type: [{ type: mongoose.Schema.Types.Mixed }], default: undefined },
        expiredAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

messageSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ createdAt: 1 });
messageSchema.index({ messageId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Message", messageSchema);
