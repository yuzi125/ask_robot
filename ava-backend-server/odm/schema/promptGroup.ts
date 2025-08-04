import { Schema, Document, Types } from 'mongoose';

export declare enum Constants {
    /** Key for the app's version. */
    VERSION = "v0.7.8",
    /** Key for the Custom Config's version (librechat.yaml). */
    CONFIG_VERSION = "1.2.5",
    /** Standard value for the first message's `parentMessageId` value, to indicate no parent exists. */
    NO_PARENT = "00000000-0000-0000-0000-000000000000",
    /** Standard value for the initial conversationId before a request is sent */
    NEW_CONVO = "new",
    /** Standard value for the temporary conversationId after a request is sent and before the server responds */
    PENDING_CONVO = "PENDING",
    /** Standard value for the conversationId used for search queries */
    SEARCH = "search",
    /** Fixed, encoded domain length for Azure OpenAI Assistants Function name parsing. */
    ENCODED_DOMAIN_LENGTH = 10,
    /** Identifier for using current_model in multi-model requests. */
    CURRENT_MODEL = "current_model",
    /** Common divider for text values */
    COMMON_DIVIDER = "__",
    /** Max length for commands */
    COMMANDS_MAX_LENGTH = 56,
    /** Default Stream Rate (ms) */
    DEFAULT_STREAM_RATE = 1,
    /** Saved Tag */
    SAVED_TAG = "Saved",
    /** Max number of Conversation starters for Agents/Assistants */
    MAX_CONVO_STARTERS = 4,
    /** Global/instance Project Name */
    GLOBAL_PROJECT_NAME = "instance",
    /** Delimiter for MCP tools */
    mcp_delimiter = "_mcp_",
    /** Placeholder Agent ID for Ephemeral Agents */
    EPHEMERAL_AGENT_ID = "ephemeral"
}

export interface IPromptGroup {
  name: string;
  numberOfGenerations: number;
  oneliner: string;
  category: string;
  projectIds: Types.ObjectId[];
  productionId: Types.ObjectId;
  author: Types.ObjectId;
  authorName: string;
  command?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPromptGroupDocument extends IPromptGroup, Document {}

const promptGroupSchema = new Schema<IPromptGroupDocument>(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    numberOfGenerations: {
      type: Number,
      default: 0,
    },
    oneliner: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: '',
      index: true,
    },
    projectIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Project',
      index: true,
      default: [],
    },
    productionId: {
      type: Schema.Types.ObjectId,
      ref: 'Prompt',
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    command: {
      type: String,
      index: true,
      validate: {
        validator: function (v: unknown): boolean {
          return v === undefined || v === null || v === '' || /^[a-z0-9-]+$/.test(v);
        },
        message: (props: unknown) =>
          `${props.value} is not a valid command. Only lowercase alphanumeric characters and hyphens are allowed.`,
      },
      maxlength: [
        Constants.COMMANDS_MAX_LENGTH as number,
        `Command cannot be longer than ${Constants.COMMANDS_MAX_LENGTH} characters`,
      ],
    }, // Casting here bypasses the type error for the command field.
  },
  {
    timestamps: true,
  },
);

promptGroupSchema.index({ createdAt: 1, updatedAt: 1 });

export default promptGroupSchema;
