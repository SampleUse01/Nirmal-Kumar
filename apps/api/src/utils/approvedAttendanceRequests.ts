import { WorkRequest } from "../models/WorkRequest.js";
import { calculateAttendanceMetrics, type AttendanceMetrics } from "./attendance.js";

export async function calculateApprovedAttendanceMetrics(
  employeeId: string,
  workDate: Date,
  checkInAt: Date,
  checkOutAt: Date
): Promise<AttendanceMetrics> {
  const start = new Date(workDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const requests = await WorkRequest.find({
    employeeId,
    status: "APPROVED",
    kind: { $in: ["PERMISSION", "OVERTIME"] },
    "data.date": { $gte: start, $lt: end }
  }).select("kind data");

  const metrics = calculateAttendanceMetrics(checkInAt, checkOutAt);
  let approvedOvertimeMinutes = 0;
  for (const request of requests) {
    const data = request.data as { permissionType?: string; extraHours?: number };
    if (request.kind === "PERMISSION" && data.permissionType === "LATE_ARRIVAL") {
      metrics.lateMinutes = 0;
    }
    if (request.kind === "PERMISSION" && data.permissionType === "EARLY_EXIT") {
      metrics.earlyLeaveMinutes = 0;
    }
    if (request.kind === "OVERTIME" && data.extraHours) {
      approvedOvertimeMinutes += Math.round(data.extraHours * 60);
    }
  }
  metrics.overtimeMinutes += approvedOvertimeMinutes;
  return metrics;
}
