import { Schema, model } from "mongoose";

const attendanceSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    workDate: { type: Date, required: true },
    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date, default: null },
    workingMinutes: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    earlyLeaveMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 }
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, workDate: 1 }, { unique: true });

export const Attendance = model("Attendance", attendanceSchema);
