import { Schema, model } from "mongoose";

export const REQUEST_KINDS = ["LEAVE", "PERMISSION", "OVERTIME", "REGULARIZATION"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

const workRequestSchema = new Schema(
  {
    kind: { type: String, enum: REQUEST_KINDS, required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: REQUEST_STATUSES, default: "PENDING", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewReason: { type: String, trim: true, maxlength: 1000, default: "" },
    comments: { type: String, trim: true, maxlength: 1000, default: "" }
  },
  { timestamps: true }
);

workRequestSchema.index({ employeeId: 1, createdAt: -1 });
workRequestSchema.index({ status: 1, kind: 1, createdAt: -1 });

export const WorkRequest = model("WorkRequest", workRequestSchema);
