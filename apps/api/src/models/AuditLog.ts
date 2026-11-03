import { Schema, model } from "mongoose";

const auditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    role: { type: String, required: true },
    action: { type: String, required: true, maxlength: 40 },
    module: { type: String, required: true, maxlength: 80 },
    description: { type: String, required: true, maxlength: 1000 },
    ipAddress: { type: String, maxlength: 64, default: "" }
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog = model("AuditLog", auditLogSchema);
