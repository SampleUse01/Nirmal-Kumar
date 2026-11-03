import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { Attendance } from "../models/Attendance.js";
import { AuditLog } from "../models/AuditLog.js";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { Notification } from "../models/Notification.js";
import { User, type Role } from "../models/User.js";
import { WorkRequest, type RequestKind } from "../models/WorkRequest.js";
import { calculateAttendanceMetrics } from "../utils/attendance.js";

if (env.NODE_ENV === "production") {
  throw new Error("Workforce demo seeding is disabled in production.");
}

if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.DEMO_ADMIN_EMAIL || !env.DEMO_EMPLOYEE_EMAIL || !env.DEMO_EMPLOYEE_PASSWORD) {
  throw new Error("Set bootstrap, demo admin, demo employee emails, and DEMO_EMPLOYEE_PASSWORD in apps/api/.env. Run seed:workforce only after configuring demo values.");
}
if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/.test(env.DEMO_EMPLOYEE_PASSWORD)) {
  throw new Error("DEMO_EMPLOYEE_PASSWORD must have 8-128 characters, uppercase, lowercase, a number, and a special character.");
}

const employeePassword = env.DEMO_EMPLOYEE_PASSWORD;
const demoEmployees = [
  ["Demo Employee", "Software Engineer", "Engineering", "0000000001", "Demo address 01, Example District", 2],
  ["Diya Patel", "HR Specialist", "People Operations", "0000000002", "Demo address 02, Example District", 3],
  ["Kabir Nair", "QA Engineer", "Engineering", "0000000003", "Demo address 03, Example District", 1],
  ["Ananya Iyer", "Support Analyst", "Operations", "0000000004", "Demo address 04, Example District", 4],
  ["Vivaan Reddy", "Finance Associate", "Finance", "0000000005", "Demo address 05, Example District", 2],
  ["Meera Joshi", "Product Designer", "Engineering", "0000000006", "Demo address 06, Example District", 5],
  ["Arjun Mehta", "Operations Coordinator", "Operations", "0000000007", "Demo address 07, Example District", 1],
  ["Sara Khan", "Talent Partner", "People Operations", "0000000008", "Demo address 08, Example District", 3],
  ["Ishaan Das", "Data Analyst", "Finance", "0000000009", "Demo address 09, Example District", 2],
  ["Tara Menon", "Customer Support", "Operations", "0000000010", "Demo address 10, Example District", 4]
] as const;
const requestKinds: RequestKind[] = ["LEAVE", "PERMISSION", "OVERTIME", "REGULARIZATION"];
const statuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
const shiftStartMinutes = 9 * 60;

function dayAt(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function joiningDateYearsAgo(years: number, daysAgo: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return addDays(date, -daysAgo);
}

async function ensureUser(emailInput: string, password: string, role: Role, mustChangePassword: boolean) {
  const email = emailInput.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== role || !existing.active) {
      throw new Error(`The demo account ${email} must be active with role ${role}.`);
    }
    return existing;
  }
  return User.create({
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role,
    active: true,
    mustChangePassword
  });
}

async function ensureDepartment(name: string) {
  const department = await Department.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (department && !department.active) {
    throw new Error(`Restore the archived department "${name}" before running the workforce demo seed.`);
  }
  return department ?? Department.create({ name, description: `${name} demo team.` });
}

async function ensureEmployee(
  input: {
    employeeId: string;
    name: string;
    email: string;
    designation: string;
    phone: string;
    address: string;
    joiningDate: Date;
    departmentId: InstanceType<typeof Department>["_id"];
    userId: InstanceType<typeof User>["_id"];
    managerId?: InstanceType<typeof Employee>["_id"];
  }
) {
  const existing = await Employee.findOne({
    $or: [{ userId: input.userId }, { employeeId: input.employeeId }, { email: input.email }]
  });
  if (existing) {
    const matches = existing.userId?.toString() === input.userId.toString()
      && existing.employeeId === input.employeeId
      && existing.email.toLowerCase() === input.email.toLowerCase();
    if (!matches || !existing.active) {
      throw new Error(`A conflicting or inactive employee record exists for ${input.email}.`);
    }
    let changed = false;
    if (!existing.phone) {
      existing.phone = input.phone;
      changed = true;
    }
    if (!existing.address) {
      existing.address = input.address;
      changed = true;
    }
    if (!existing.joiningDate) {
      existing.joiningDate = input.joiningDate;
      changed = true;
    }
    if (!existing.departmentId) {
      existing.departmentId = input.departmentId;
      changed = true;
    }
    if (!existing.managerId && input.managerId) {
      existing.managerId = input.managerId;
      changed = true;
    }
    if (changed) await existing.save();
    return existing;
  }
  return Employee.create(input);
}

async function ensureAttendance(employeeId: InstanceType<typeof Employee>["_id"], workDate: Date, index: number) {
  const existing = await Attendance.findOne({ employeeId, workDate });
  if (existing) return existing;

  const checkInAt = dayAt(workDate, shiftStartMinutes + (index % 4) * 7);
  const checkOutAt = dayAt(workDate, 18 * 60 + (index % 3) * 10);
  return Attendance.create({
    employeeId,
    workDate,
    checkInAt,
    checkOutAt,
    ...calculateAttendanceMetrics(checkInAt, checkOutAt)
  });
}

function requestData(kind: RequestKind, employeeIndex: number, workDate: Date) {
  switch (kind) {
    case "LEAVE": {
      const startDate = addDays(workDate, 2 + employeeIndex % 5);
      return {
        leaveType: employeeIndex % 2 === 0 ? "CASUAL" : "SICK",
        startDate,
        endDate: addDays(startDate, 1),
        totalDays: 2,
        reason: "Demo request: personal time and family commitments."
      };
    }
    case "PERMISSION":
      return {
        date: workDate,
        permissionType: employeeIndex % 2 === 0 ? "LATE_ARRIVAL" : "PERSONAL_WORK",
        startTime: "09:15",
        endTime: "10:00",
        reason: "Demo request: appointment and adjusted arrival."
      };
    case "OVERTIME":
      return {
        date: workDate,
        shift: "General shift",
        extraHours: 1 + employeeIndex % 2,
        reason: "Demo request: additional coverage.",
        taskDetails: "Complete a planned handover and close remaining team tasks."
      };
    case "REGULARIZATION": {
      const correctionDate = addDays(workDate, -(employeeIndex % 8));
      return {
        date: correctionDate,
        checkInAt: dayAt(correctionDate, 9 * 60 + 12),
        checkOutAt: dayAt(correctionDate, 18 * 60),
        reason: "Demo request: correct a missed punch."
      };
    }
  }
}

async function ensureRequest(input: {
  employee: InstanceType<typeof Employee>;
  kind: RequestKind;
  status: typeof statuses[number];
  reviewerId: InstanceType<typeof User>["_id"];
  employeeIndex: number;
  requestDate: Date;
}) {
  const seedKey = `workforce-demo-v1-${input.employee.employeeId}-${input.kind}`;
  let workRequest = await WorkRequest.findOne({ employeeId: input.employee._id, kind: input.kind, "data.seedKey": seedKey });
  if (workRequest) return { workRequest, created: false };

  const isReviewed = input.status === "APPROVED" || input.status === "REJECTED";
  workRequest = await WorkRequest.create({
    kind: input.kind,
    employeeId: input.employee._id,
    data: { ...requestData(input.kind, input.employeeIndex, input.requestDate), seedKey },
    status: input.status,
    reviewedBy: isReviewed ? input.reviewerId : null,
    reviewedAt: isReviewed ? addDays(input.requestDate, 1) : null,
    reviewReason: input.status === "REJECTED" ? "Demo rejection: coverage or policy requirements." : "",
    comments: input.status === "APPROVED" ? "Demo approval for workflow testing." : ""
  });
  return { workRequest, created: true };
}

await connectDatabase();
try {
  const adminUser = await User.findOne({ email: env.DEMO_ADMIN_EMAIL.toLowerCase(), role: "ADMIN", active: true });
  if (!adminUser) throw new Error("Demo Admin account not found. Run `npm run seed:demo -w @wms/api` first.");
  const adminEmployee = await Employee.findOne({ userId: adminUser._id, active: true });
  if (!adminEmployee) throw new Error("Demo Admin employee profile is missing. Run `npm run seed:demo -w @wms/api` first.");

  const departments = new Map<string, InstanceType<typeof Department>>();
  for (const name of new Set(demoEmployees.map(([, , department]) => department))) {
    departments.set(name, await ensureDepartment(name));
  }

  const employees: InstanceType<typeof Employee>[] = [];
  for (const [index, [name, designation, departmentName, phone, address, yearsEmployed]] of demoEmployees.entries()) {
    const serial = String(index + 1).padStart(2, "0");
    const email = index === 0
      ? env.DEMO_EMPLOYEE_EMAIL.toLowerCase()
      : env.DEMO_EMPLOYEE_EMAIL.replace("@", `+${serial}@`).toLowerCase();
    const user = await ensureUser(email, employeePassword, "EMPLOYEE", true);
    const department = departments.get(departmentName)!;
    employees.push(await ensureEmployee({
      employeeId: index === 0 ? "DEMO-EMP-001" : `DEMO-WF-${serial}`,
      name,
      email,
      designation,
      phone,
      address,
      joiningDate: joiningDateYearsAgo(yearsEmployed, index * 17),
      departmentId: department._id,
      userId: user._id,
      managerId: adminEmployee._id
    }));
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const attendanceDates: Date[] = [];
  for (let offset = 1; attendanceDates.length < 10; offset += 1) {
    const date = addDays(today, -offset);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) attendanceDates.push(date);
  }
  let attendanceCount = 0;
  for (const [employeeIndex, employee] of employees.entries()) {
    for (const [dayIndex, workDate] of attendanceDates.entries()) {
      await ensureAttendance(employee._id, workDate, employeeIndex + dayIndex);
      attendanceCount += 1;
    }
  }

  let requestCount = 0;
  let notificationCount = 0;
  let auditCount = 0;
  for (const [employeeIndex, employee] of employees.entries()) {
    const employeeUser = await User.findById(employee.userId);
    if (!employeeUser) throw new Error(`Missing login account for ${employee.email}.`);
    for (const [kindIndex, kind] of requestKinds.entries()) {
      const status = statuses[(employeeIndex + kindIndex) % statuses.length];
      const requestDate = attendanceDates[(employeeIndex + kindIndex) % attendanceDates.length];
      const { workRequest, created } = await ensureRequest({
        employee,
        kind,
        status,
        reviewerId: adminUser._id,
        employeeIndex,
        requestDate
      });
      if (created) requestCount += 1;

      const decision = workRequest.status === "APPROVED" ? "approved"
        : workRequest.status === "REJECTED" ? "rejected"
          : workRequest.status === "CANCELLED" ? "cancelled" : "submitted";
      const title = `${kind[0]}${kind.slice(1).toLowerCase()} demo request ${decision}`;
      const employeeNotificationExists = await Notification.exists({
        userId: employeeUser._id,
        relatedRequestId: workRequest._id,
        title
      });
      if (!employeeNotificationExists) {
        await Notification.create({
          userId: employeeUser._id,
          title,
          message: workRequest.status === "REJECTED"
            ? `Demo workflow sample: ${workRequest.reviewReason}`
            : `Demo workflow sample: your ${kind.toLowerCase()} request is ${workRequest.status.toLowerCase()}.`,
          status: employeeIndex % 3 === 0 ? "UNREAD" : "READ",
          relatedRequestId: workRequest._id
        });
        notificationCount += 1;
      }

      if (workRequest.status === "PENDING") {
        const adminNotificationExists = await Notification.exists({
          userId: adminUser._id,
          relatedRequestId: workRequest._id,
          title: "Demo request pending review"
        });
        if (!adminNotificationExists) {
          await Notification.create({
            userId: adminUser._id,
            title: "Demo request pending review",
            message: `${employee.name} has a demo ${kind.toLowerCase()} request awaiting review.`,
            status: "UNREAD",
            relatedRequestId: workRequest._id
          });
          notificationCount += 1;
        }
      }

      const wasReviewed = workRequest.status === "APPROVED" || workRequest.status === "REJECTED";
      const action = workRequest.status === "PENDING" ? "CREATE"
        : workRequest.status === "APPROVED" ? "APPROVE"
          : workRequest.status === "REJECTED" ? "REJECT" : "CANCEL";
      const description = `Demo seed: ${employee.employeeId} ${kind.toLowerCase()} request ${workRequest.status.toLowerCase()}.`;
      if (!(await AuditLog.exists({ description }))) {
        await AuditLog.create({
          userId: wasReviewed ? adminUser._id : employeeUser._id,
          role: wasReviewed ? "ADMIN" : "EMPLOYEE",
          action,
          module: "WORK_REQUESTS",
          description,
          ipAddress: "127.0.0.1",
          createdAt: wasReviewed ? workRequest.reviewedAt : workRequest.createdAt
        });
        auditCount += 1;
      }
    }
  }

  console.log("Workforce demo data is ready.");
  console.log(`Created/verified ${employees.length} complete employee profiles (phone, address, department, manager, and joining date) across ${attendanceDates.length} weekdays (${attendanceCount} attendance records).`);
  console.log(`Created ${requestCount} request samples across Leave, Permission, Overtime, and Regularization.`);
  console.log(`Created ${notificationCount} notifications and ${auditCount} audit entries for the seeded requests.`);
  console.log(`Super Admin: ${env.BOOTSTRAP_ADMIN_EMAIL}`);
  console.log(`Admin: ${env.DEMO_ADMIN_EMAIL}`);
  console.log(`Employee logins: ${env.DEMO_EMPLOYEE_EMAIL}, then ${env.DEMO_EMPLOYEE_EMAIL.replace("@", "+02@")} through ${env.DEMO_EMPLOYEE_EMAIL.replace("@", "+10@")}`);
  console.log("Demo employee passwords use DEMO_EMPLOYEE_PASSWORD and require a change at first login. Existing passwords are preserved.");
} finally {
  await disconnectDatabase();
}
