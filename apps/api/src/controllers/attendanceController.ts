import type { RequestHandler } from "express";
import { Attendance } from "../models/Attendance.js";
import { Employee } from "../models/Employee.js";
import { HttpError } from "../utils/errors.js";
import { calculateApprovedAttendanceMetrics } from "../utils/approvedAttendanceRequests.js";
import { roleHasPermission } from "../utils/rbac.js";
import type { PermissionKey } from "../config/permissions.js";
import { getDateRange, toCsv } from "../utils/dateFilters.js";

async function getOwnEmployee(userId: string) {
  const employee = await Employee.findOne({ userId, active: true });
  if (!employee) throw new HttpError(404, "No active employee profile is linked to this account.");
  return employee;
}

async function requireAttendancePermission(role: "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE", permission: PermissionKey) {
  if (!(await roleHasPermission(role, permission))) {
    throw new HttpError(403, "You do not have permission to view attendance.");
  }
}

export const getTodayAttendance: RequestHandler = async (request, response) => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  if (request.authUser!.role === "EMPLOYEE") {
    await requireAttendancePermission(request.authUser!.role, "ATTENDANCE_SELF");
    const employee = await getOwnEmployee(request.authUser!.id);
    const attendance = await Attendance.findOne({
      employeeId: employee.id,
      workDate: { $gte: start, $lt: end }
    });
    response.json({ attendance });
    return;
  }
  await requireAttendancePermission(request.authUser!.role, "ATTENDANCE_TEAM");
  const attendances = await Attendance.find({ workDate: { $gte: start, $lt: end } })
    .populate("employeeId", "employeeId name departmentId")
    .sort({ checkInAt: 1 });
  response.json({ attendances });
};

export const listAttendance: RequestHandler = async (request, response) => {
  const role = request.authUser!.role;
  const permission = role === "EMPLOYEE" ? "ATTENDANCE_SELF" : "ATTENDANCE_TEAM";
  await requireAttendancePermission(role, permission);
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
  const filter: Record<string, unknown> = {};
  if (role === "EMPLOYEE") {
    filter.employeeId = (await getOwnEmployee(request.authUser!.id)).id;
  } else if (typeof request.query.employeeId === "string") {
    filter.employeeId = request.query.employeeId;
  }
  const workDate = getDateRange(request.query);
  if (workDate) filter.workDate = workDate;
  if (role !== "EMPLOYEE" && typeof request.query.search === "string" && request.query.search.trim()) {
    const escaped = request.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const employees = await Employee.find({
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { employeeId: { $regex: escaped, $options: "i" } }
      ]
    }).select("_id");
    filter.employeeId = { $in: employees.map((employee) => employee._id) };
  }
  const [attendances, total] = await Promise.all([
    Attendance.find(filter).populate("employeeId", "employeeId name")
      .sort({ workDate: -1 }).skip((page - 1) * limit).limit(limit),
    Attendance.countDocuments(filter)
  ]);
  response.json({ attendances, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const getAttendanceSummary: RequestHandler = async (request, response) => {
  const role = request.authUser!.role;
  await requireAttendancePermission(role, role === "EMPLOYEE" ? "ATTENDANCE_SELF" : "ATTENDANCE_TEAM");
  const filter: Record<string, unknown> = {};
  if (role === "EMPLOYEE") filter.employeeId = (await getOwnEmployee(request.authUser!.id))._id;
  const workDate = getDateRange(request.query);
  if (workDate) filter.workDate = workDate;
  const [summary, attendances] = await Promise.all([
    Attendance.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        completedRecords: { $sum: { $cond: [{ $ne: ["$checkOutAt", null] }, 1, 0] } },
        workingMinutes: { $sum: "$workingMinutes" },
        overtimeMinutes: { $sum: "$overtimeMinutes" }
      } }
    ]),
    Attendance.find(filter)
      .populate("employeeId", "employeeId name")
      .sort({ workDate: -1 })
      .limit(6)
  ]);
  const values = summary[0] ?? { totalRecords: 0, completedRecords: 0, workingMinutes: 0, overtimeMinutes: 0 };
  response.json({
    summary: { ...values, ongoingRecords: values.totalRecords - values.completedRecords },
    attendances
  });
};

export const exportAttendance: RequestHandler = async (request, response) => {
  const role = request.authUser!.role;
  await requireAttendancePermission(role, role === "EMPLOYEE" ? "ATTENDANCE_SELF" : "ATTENDANCE_TEAM");
  const filter: Record<string, unknown> = {};
  if (role === "EMPLOYEE") filter.employeeId = (await getOwnEmployee(request.authUser!.id)).id;
  const workDate = getDateRange(request.query);
  if (workDate) filter.workDate = workDate;
  if (role !== "EMPLOYEE" && typeof request.query.search === "string" && request.query.search.trim()) {
    const escaped = request.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const employees = await Employee.find({
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { employeeId: { $regex: escaped, $options: "i" } }
      ]
    }).select("_id");
    filter.employeeId = { $in: employees.map((employee) => employee._id) };
  }
  const attendances = await Attendance.find(filter)
    .populate("employeeId", "employeeId name")
    .sort({ workDate: -1 });
  response.type("text/csv").attachment("attendance.csv").send(toCsv(
    ["workDate", "employeeId", "employeeName", "checkInAt", "checkOutAt", "workingMinutes", "lateMinutes", "earlyLeaveMinutes", "overtimeMinutes"],
    attendances.map((attendance) => {
      const employee = attendance.employeeId as unknown as { employeeId?: string; name?: string };
      return [
        attendance.workDate, employee?.employeeId, employee?.name, attendance.checkInAt,
        attendance.checkOutAt, attendance.workingMinutes, attendance.lateMinutes,
        attendance.earlyLeaveMinutes, attendance.overtimeMinutes
      ];
    })
  ));
};

export const exportAttendanceSummary: RequestHandler = async (request, response) => {
  const role = request.authUser!.role;
  await requireAttendancePermission(role, role === "EMPLOYEE" ? "ATTENDANCE_SELF" : "ATTENDANCE_TEAM");
  const filter: Record<string, unknown> = {};
  if (role === "EMPLOYEE") filter.employeeId = (await getOwnEmployee(request.authUser!.id))._id;
  const workDate = getDateRange(request.query);
  if (workDate) filter.workDate = workDate;
  const [values] = await Attendance.aggregate([
    { $match: filter },
    { $group: {
      _id: null,
      totalRecords: { $sum: 1 },
      completedRecords: { $sum: { $cond: [{ $ne: ["$checkOutAt", null] }, 1, 0] } },
      workingMinutes: { $sum: "$workingMinutes" },
      overtimeMinutes: { $sum: "$overtimeMinutes" }
    } }
  ]);
  const totals = values ?? { totalRecords: 0, completedRecords: 0, workingMinutes: 0, overtimeMinutes: 0 };
  const csv = toCsv(
    ["attendanceRecords", "completedRecords", "ongoingRecords", "workingMinutes", "overtimeMinutes"],
    [[totals.totalRecords, totals.completedRecords, totals.totalRecords - totals.completedRecords, totals.workingMinutes, totals.overtimeMinutes]]
  );
  response.type("text/csv").attachment("dashboard-attendance-summary.csv").send(csv);
};

export const checkIn: RequestHandler = async (request, response) => {
  const employee = await getOwnEmployee(request.authUser!.id);
  const now = new Date();
  const workDate = new Date(now);
  workDate.setUTCHours(0, 0, 0, 0);
  const attendance = await Attendance.create({ employeeId: employee.id, workDate, checkInAt: now });
  response.status(201).json({ attendance });
};

export const checkOut: RequestHandler = async (request, response) => {
  const employee = await getOwnEmployee(request.authUser!.id);
  const now = new Date();
  const workDate = new Date(now);
  workDate.setUTCHours(0, 0, 0, 0);
  const attendance = await Attendance.findOne({
    employeeId: employee.id, workDate, checkOutAt: null
  });
  if (!attendance) throw new HttpError(409, "There is no open attendance record to check out from today.");
  if (now < attendance.checkInAt) throw new HttpError(400, "Check-out must be after check-in.");
  Object.assign(
    attendance,
    await calculateApprovedAttendanceMetrics(employee.id, attendance.workDate, attendance.checkInAt, now)
  );
  attendance.checkOutAt = now;
  await attendance.save();
  response.json({ attendance });
};

export const getTeamTodayAttendance: RequestHandler = async (_request, response) => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const attendances = await Attendance.find({ workDate: { $gte: start, $lt: end } })
    .populate("employeeId", "employeeId name departmentId")
    .sort({ checkInAt: 1 });
  response.json({ attendances });
};
