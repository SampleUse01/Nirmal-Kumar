import { Schema, model } from "mongoose";
import { PERMISSION_KEYS } from "../config/permissions.js";
import { ROLES } from "./User.js";

const roleAccessSchema = new Schema(
  {
    role: { type: String, enum: ROLES, required: true, unique: true },
    permissions: { type: [{ type: String, enum: PERMISSION_KEYS }], required: true, default: [] }
  },
  { timestamps: true }
);

export const RoleAccess = model("RoleAccess", roleAccessSchema);
