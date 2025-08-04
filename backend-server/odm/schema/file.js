const mongoose = require('mongoose');
const { Schema } = mongoose;

const FileSources = {
  local: 'local',
  firebase: 'firebase',
  azure: 'azure',
  azure_blob: 'azure_blob',
  openai: 'openai',
  s3: 's3',
  vectordb: 'vectordb',
  execute_code: 'execute_code',
  mistral_ocr: 'mistral_ocr',
  text: 'text',
};

const fileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    conversationId: {
      type: String,
      ref: 'Conversation',
      index: true,
    },
    file_id: {
      type: String,
      index: true,
      required: true,
    },
    temp_file_id: {
      type: String,
    },
    bytes: {
      type: Number,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    filepath: {
      type: String,
      required: true,
    },
    object: {
      type: String,
      required: true,
      default: 'file',
    },
    embedded: {
      type: Boolean,
    },
    type: {
      type: String,
      required: true,
    },
    text: {
      type: String,
    },
    context: {
      type: String,
    },
    usage: {
      type: Number,
      required: true,
      default: 0,
    },
    source: {
      type: String,
      default: FileSources.local,
    },
    model: {
      type: String,
    },
    width: Number,
    height: Number,
    metadata: {
      fileIdentifier: String,
    },
    expiresAt: {
      type: Date,
      expires: 3600,
    },
  },
  {
    timestamps: true,
  }
);

fileSchema.index({ createdAt: 1, updatedAt: 1 });

module.exports = mongoose.model('File', fileSchema);
