import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ["UNREAD", "READ", "ARCHIVED"], default: "UNREAD" },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: "WorkRequest", default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const Notification = model("Notification", notificationSchema);
