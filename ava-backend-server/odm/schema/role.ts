import { Schema, Document } from 'mongoose';
export declare enum PermissionTypes {
    /**
     * Type for Prompt Permissions
     */
    PROMPTS = "PROMPTS",
    /**
     * Type for Bookmark Permissions
     */
    BOOKMARKS = "BOOKMARKS",
    /**
     * Type for Agent Permissions
     */
    AGENTS = "AGENTS",
    /**
     * Type for Multi-Conversation Permissions
     */
    MULTI_CONVO = "MULTI_CONVO",
    /**
     * Type for Temporary Chat
     */
    TEMPORARY_CHAT = "TEMPORARY_CHAT",
    /**
     * Type for using the "Run Code" LC Code Interpreter API feature
     */
    RUN_CODE = "RUN_CODE"
}
/**
 * Enum for Role-Based Access Control Constants
 */
export declare enum Permissions {
    SHARED_GLOBAL = "SHARED_GLOBAL",
    USE = "USE",
    CREATE = "CREATE",
    UPDATE = "UPDATE",
    READ = "READ",
    READ_AUTHOR = "READ_AUTHOR",
    SHARE = "SHARE"
}
export interface IRole extends Document {
  name: string;
  permissions: {
    [PermissionTypes.BOOKMARKS]?: {
      [Permissions.USE]?: boolean;
    };
    [PermissionTypes.PROMPTS]?: {
      [Permissions.SHARED_GLOBAL]?: boolean;
      [Permissions.USE]?: boolean;
      [Permissions.CREATE]?: boolean;
    };
    [PermissionTypes.AGENTS]?: {
      [Permissions.SHARED_GLOBAL]?: boolean;
      [Permissions.USE]?: boolean;
      [Permissions.CREATE]?: boolean;
    };
    [PermissionTypes.MULTI_CONVO]?: {
      [Permissions.USE]?: boolean;
    };
    [PermissionTypes.TEMPORARY_CHAT]?: {
      [Permissions.USE]?: boolean;
    };
    [PermissionTypes.RUN_CODE]?: {
      [Permissions.USE]?: boolean;
    };
  };
}

// Create a sub-schema for permissions. Notice we disable _id for this subdocument.
const rolePermissionsSchema = new Schema(
  {
    [PermissionTypes.BOOKMARKS]: {
      [Permissions.USE]: { type: Boolean, default: true },
    },
    [PermissionTypes.PROMPTS]: {
      [Permissions.SHARED_GLOBAL]: { type: Boolean, default: false },
      [Permissions.USE]: { type: Boolean, default: true },
      [Permissions.CREATE]: { type: Boolean, default: true },
    },
    [PermissionTypes.AGENTS]: {
      [Permissions.SHARED_GLOBAL]: { type: Boolean, default: false },
      [Permissions.USE]: { type: Boolean, default: true },
      [Permissions.CREATE]: { type: Boolean, default: true },
    },
    [PermissionTypes.MULTI_CONVO]: {
      [Permissions.USE]: { type: Boolean, default: true },
    },
    [PermissionTypes.TEMPORARY_CHAT]: {
      [Permissions.USE]: { type: Boolean, default: true },
    },
    [PermissionTypes.RUN_CODE]: {
      [Permissions.USE]: { type: Boolean, default: true },
    },
  },
  { _id: false },
);

const roleSchema: Schema<IRole> = new Schema({
  name: { type: String, required: true, unique: true, index: true },
  permissions: {
    type: rolePermissionsSchema,
    default: () => ({
      [PermissionTypes.BOOKMARKS]: { [Permissions.USE]: true },
      [PermissionTypes.PROMPTS]: {
        [Permissions.SHARED_GLOBAL]: false,
        [Permissions.USE]: true,
        [Permissions.CREATE]: true,
      },
      [PermissionTypes.AGENTS]: {
        [Permissions.SHARED_GLOBAL]: false,
        [Permissions.USE]: true,
        [Permissions.CREATE]: true,
      },
      [PermissionTypes.MULTI_CONVO]: { [Permissions.USE]: true },
      [PermissionTypes.TEMPORARY_CHAT]: { [Permissions.USE]: true },
      [PermissionTypes.RUN_CODE]: { [Permissions.USE]: true },
    }),
  },
});

export default roleSchema;
