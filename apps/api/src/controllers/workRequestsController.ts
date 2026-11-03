import type { RequestHandler } from "express";
import { z } from "zod";
import { Attendance } from "../models/Attendance.js";
import { Employee } from "../models/Employee.js";
import { Notification } from "../models/Notification.js";
import { WorkRequest, type RequestKind } from "../models/WorkRequest.js";
import { HttpError } from "../utils/errors.js";
import { calculateApprovedAttendanceMetrics } from "../utils/approvedAttendanceRequests.js";
import { writeAudit } from "../utils/audit.js";
import { getDateRange } from "../utils/dateFilters.js";

const date = z.coerce.date();
const reason = z.string().trim().min(3).max(1000);
const requestSchemas = {
  LEAVE: z.object({
    leaveType: z.enum(["CASUAL", "SICK", "EARNED", "MATERNITY", "PATERNITY", "LOSS_OF_PAY"]),
    startDate: date, endDate: date, totalDays: z.number().positive().max(366), reason
  }),
  PERMISSION: z.object({
    date, permissionType: z.enum(["LATE_ARRIVAL", "EARLY_EXIT", "PERSONAL_WORK", "MEDICAL"]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/), reason
  }),
  OVERTIME: z.object({
    date, shift: z.string().trim().min(1).max(100), extraHours: z.number().positive().max(24),
    reason, taskDetails: z.string().trim().min(3).max(1000)
  }),
  REGULARIZATION: z.object({
    date, checkInAt: date.optional(), checkOutAt: date.optional(), reason
  }).refine((value) => value.checkInAt || value.checkOutAt, {
    message: "Provide at least one corrected punch time."
  }).refine((value) => !value.checkInAt || !value.checkOutAt || value.checkOutAt > value.checkInAt, {
    message: "Check-out must be later than check-in."
  })
} as const;

async function getOwnEmployee(userId: string) {
  const employee = await Employee.findOne({ userId, active: true });
  if (!employee) throw new HttpError(404, "No active employee profile is linked to this account.");
  return employee;
}

async function resetPendingReview(workRequest: InstanceType<typeof WorkRequest>) {
  workRequest.status = "PENDING";
  workRequest.reviewedBy = null;
  workRequest.reviewedAt = null;
  workRequest.reviewReason = "";
  workRequest.comments = "";
  await workRequest.save();
}

export const createWorkRequest: RequestHandler = async (request, response) => {
  if (request.authUser!.role !== "EMPLOYEE") {
    throw new HttpError(403, "Only employees can submit personal requests.");
  }
  const kind: RequestKind = z.enum(["LEAVE", "PERMISSION", "OVERTIME", "REGULARIZATION"]).parse(request.body?.kind);
  const parsed = requestSchemas[kind].parse(request.body.data);
  if (kind === "LEAVE" && "startDate" in parsed && parsed.startDate > parsed.endDate) {
    throw new HttpError(400, "Leave end date must be on or after the start date.");
  }
  if (kind === "LEAVE" && "startDate" in parsed) {
    const inclusiveDays = Math.floor((parsed.endDate.getTime() - parsed.startDate.getTime()) / 86_400_000) + 1;
    if (parsed.totalDays !== inclusiveDays) throw new HttpError(400, "Total leave days must match the inclusive date range.");
  }
  if (kind === "PERMISSION" && "startTime" in parsed && parsed.startTime >= parsed.endTime) {
    throw new HttpError(400, "Permission end time must be later than its start time.");
  }
  const employee = await getOwnEmployee(request.authUser!.id);
  const workRequest = await WorkRequest.create({ kind, employeeId: employee.id, data: parsed });
  await writeAudit({
    userId: request.authUser!.id, role: request.authUser!.role, action: "CREATE",
    module: "WORK_REQUESTS", description: `Submitted ${kind.toLowerCase()} request ${workRequest.id}.`,
    ipAddress: request.ip
  });
  response.status(201).json({ request: workRequest });
};

export const listWorkRequests: RequestHandler = async (request, response) => {
  const isEmployee = request.authUser!.role === "EMPLOYEE";
  const filter: Record<string, unknown> = {};
  if (isEmployee) filter.employeeId = (await getOwnEmployee(request.authUser!.id)).id;
  if (typeof request.query.kind === "string" && Object.hasOwn(requestSchemas, request.query.kind)) {
    filter.kind = request.query.kind;
  }
  if (typeof request.query.status === "string" &&
      ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(request.query.status)) {
    filter.status = request.query.status;
  }
  const createdAt = getDateRange(request.query);
  if (createdAt) filter.createdAt = createdAt;
  if (typeof request.query.search === "string" && request.query.search.trim()) {
    const escaped = request.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const conditions: Record<string, unknown>[] = [
      { "data.reason": { $regex: escaped, $options: "i" } },
      { "data.taskDetails": { $regex: escaped, $options: "i" } },
      { "data.shift": { $regex: escaped, $options: "i" } },
      { "data.leaveType": { $regex: escaped, $options: "i" } },
      { "data.permissionType": { $regex: escaped, $options: "i" } },
      { kind: { $regex: escaped, $options: "i" } },
      { status: { $regex: escaped, $options: "i" } }
    ];
    if (!isEmployee) {
      const employees = await Employee.find({
        $or: [
          { name: { $regex: escaped, $options: "i" } },
          { employeeId: { $regex: escaped, $options: "i" } }
        ]
      }).select("_id");
      conditions.push({ employeeId: { $in: employees.map((employee) => employee._id) } });
    }
    filter.$or = conditions;
  }
  const requests = await WorkRequest.find(filter)
    .populate("employeeId", "employeeId name departmentId")
    .populate("reviewedBy", "email role")
    .sort({ createdAt: -1 })
    .limit(200);
  response.json({ requests });
};

export const cancelWorkRequest: RequestHandler = async (request, response) => {
  if (request.authUser!.role !== "EMPLOYEE") {
    throw new HttpError(403, "Only employees can cancel their own pending requests.");
  }
  const employee = await getOwnEmployee(request.authUser!.id);
  const workRequest = await WorkRequest.findOneAndUpdate(
    { _id: request.params.id, employeeId: employee.id, status: "PENDING" },
    { $set: { status: "CANCELLED" } },
    { new: true }
  );
  if (!workRequest) throw new HttpError(404, "Pending request not found.");
  await writeAudit({
    userId: request.authUser!.id, role: request.authUser!.role, action: "CANCEL",
    module: "WORK_REQUESTS", description: `Cancelled ${workRequest.kind.toLowerCase()} request ${workRequest.id}.`,
    ipAddress: request.ip
  });
  response.json({ request: workRequest });
};

export const reviewWorkRequest: RequestHandler = async (request, response) => {
  const input = z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(1000).optional(),
    comments: z.string().trim().max(1000).optional()
  }).parse(request.body);
  if (input.decision === "REJECTED" && !input.reason?.trim()) {
    throw new HttpError(400, "A rejection reason is required.");
  }
  const workRequest = await WorkRequest.findOneAndUpdate(
    { _id: request.params.id, status: "PENDING" },
    { $set: {
      status: input.decision,
      reviewedBy: request.authUser!.id,
      reviewedAt: new Date(),
      reviewReason: input.reason?.trim() ?? "",
      comments: input.comments?.trim() ?? ""
    } },
    { new: true }
  );
  if (!workRequest) throw new HttpError(404, "Pending request not found.");

  if (input.decision === "APPROVED" &&
      ["REGULARIZATION", "PERMISSION", "OVERTIME"].includes(workRequest.kind)) {
    const data = workRequest.data as { date: Date; checkInAt?: Date; checkOutAt?: Date };
    const workDate = new Date(data.date);
    workDate.setUTCHours(0, 0, 0, 0);
    const attendance = await Attendance.findOne({ employeeId: workRequest.employeeId, workDate });
    if (attendance) {
      if (workRequest.kind === "REGULARIZATION") {
        if (data.checkInAt) attendance.checkInAt = data.checkInAt;
        if (data.checkOutAt) attendance.checkOutAt = data.checkOutAt;
        if (attendance.checkOutAt && attendance.checkOutAt < attendance.checkInAt) {
          await resetPendingReview(workRequest);
          throw new HttpError(400, "The corrected check-out must be later than check-in.");
        }
      }
      if (attendance.checkOutAt) {
        Object.assign(attendance, await calculateApprovedAttendanceMetrics(
          workRequest.employeeId.toString(), attendance.workDate, attendance.checkInAt, attendance.checkOutAt
        ));
      }
      try {
        await attendance.save();
      } catch (error) {
        await resetPendingReview(workRequest);
        throw error;
      }
    } else if (workRequest.kind === "REGULARIZATION") {
      await resetPendingReview(workRequest);
      throw new HttpError(409, "Create an attendance record before approving this regularization.");
    }
  }

  const employee = await Employee.findById(workRequest.employeeId).select("userId");
  if (employee?.userId) {
    const title = `${workRequest.kind[0]}${workRequest.kind.slice(1).toLowerCase()} request ${input.decision.toLowerCase()}`;
    const rejection = input.decision === "REJECTED" ? ` Reason: ${input.reason!.trim()}` : "";
    await Notification.create({
      userId: employee.userId,
      title,
      message: `Your ${workRequest.kind.toLowerCase()} request was ${input.decision.toLowerCase()}.${rejection}`,
      relatedRequestId: workRequest.id
    });
  }
  await writeAudit({
    userId: request.authUser!.id,
    role: request.authUser!.role,
    action: input.decision === "APPROVED" ? "APPROVE" : "REJECT",
    module: "WORK_REQUESTS",
    description: `${input.decision} ${workRequest.kind.toLowerCase()} request ${workRequest.id}${input.reason ? `: ${input.reason}` : ""}.`,
    ipAddress: request.ip
  });
  response.json({ request: workRequest });
};
