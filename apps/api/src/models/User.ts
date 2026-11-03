import { Schema, model } from "mongoose";

export const ROLES = ["SUPER_ADMIN", "ADMIN", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: "EMPLOYEE" },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

export const User = model("User", userSchema);
