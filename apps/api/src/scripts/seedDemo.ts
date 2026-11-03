import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { Attendance } from "../models/Attendance.js";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { User, type Role } from "../models/User.js";
import { calculateAttendanceMetrics } from "../utils/attendance.js";

const passwordSchema = z
  .string()
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/,
    "Use 8-128 characters with uppercase, lowercase, a number, and a special character."
  );

if (env.NODE_ENV === "production") {
  throw new Error("Demo seeding is disabled in production.");
}

const required = {
  bootstrapEmail: env.BOOTSTRAP_ADMIN_EMAIL,
  bootstrapPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
  adminEmail: env.DEMO_ADMIN_EMAIL,
  adminPassword: env.DEMO_ADMIN_PASSWORD,
  employeeEmail: env.DEMO_EMPLOYEE_EMAIL,
  employeePassword: env.DEMO_EMPLOYEE_PASSWORD
};

for (const [key, value] of Object.entries(required)) {
  if (!value) throw new Error(`Set the corresponding bootstrap/demo value in apps/api/.env (${key}).`);
}

const credentials = {
  bootstrapEmail: z.string().email().parse(required.bootstrapEmail).toLowerCase(),
  bootstrapPassword: passwordSchema.parse(required.bootstrapPassword),
  adminEmail: z.string().email().parse(required.adminEmail).toLowerCase(),
  adminPassword: passwordSchema.parse(required.adminPassword),
  employeeEmail: z.string().email().parse(required.employeeEmail).toLowerCase(),
  employeePassword: passwordSchema.parse(required.employeePassword)
};

const configuredEmails = [
  credentials.bootstrapEmail,
  credentials.adminEmail,
  credentials.employeeEmail
];
if (new Set(configuredEmails).size !== configuredEmails.length) {
  throw new Error("Bootstrap, demo admin, and demo employee accounts must use different email addresses.");
}

async function ensureUser(email: string, password: string, role: Role, mustChangePassword: boolean) {
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== role) {
      throw new Error(`The existing ${email} account has role ${existing.role}; expected ${role}.`);
    }
    if (!existing.active) throw new Error(`The existing ${email} account is inactive; reactivate it before seeding.`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { email },
    {
      $setOnInsert: {
        email,
        passwordHash,
        role,
        active: true,
        mustChangePassword,
        tokenVersion: 0
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (!user || user.role !== role) {
    throw new Error(`Could not safely create the ${role} account for ${email}.`);
  }
  return user;
}

async function ensureDepartment(name: string, description: string) {
  const existing = await Department.findOne({ name });
  if (existing) {
    if (!existing.active) throw new Error(`The demo department "${name}" exists but is archived.`);
    return existing;
  }
  return Department.create({ name, description });
}

async function ensureEmployee(input: {
  employeeId: string;
  name: string;
  email: string;
  designation: string;
  departmentId: Types.ObjectId;
  userId: Types.ObjectId;
  managerId?: Types.ObjectId;
}) {
  const [linked, byEmployeeId, byEmail] = await Promise.all([
    Employee.findOne({ userId: input.userId }),
    Employee.findOne({ employeeId: input.employeeId }),
    Employee.findOne({ email: input.email })
  ]);
  const existing = linked ?? byEmployeeId ?? byEmail;
  if (existing) {
    if (
      existing.userId?.toString() !== input.userId.toString() ||
      existing.employeeId !== input.employeeId ||
      existing.email !== input.email
    ) {
      throw new Error(`A conflicting employee record exists for demo account ${input.email}.`);
    }
    if (!existing.active) throw new Error(`The demo employee ${input.email} is inactive; reactivate it before seeding.`);
    return existing;
  }
  return Employee.create(input);
}

async function ensureAttendance(
  employeeId: Types.ObjectId,
  workDate: Date,
  checkInAt: Date,
  checkOutAt: Date | null
) {
  const existing = await Attendance.findOne({ employeeId, workDate });
  if (existing) return existing;

  const metrics = checkOutAt
    ? calculateAttendanceMetrics(checkInAt, checkOutAt)
    : { workingMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };
  return Attendance.create({
    employeeId,
    workDate,
    checkInAt,
    checkOutAt,
    ...metrics
  });
}

await connectDatabase();
try {
  const superAdmin = await ensureUser(
    credentials.bootstrapEmail,
    credentials.bootstrapPassword,
    "SUPER_ADMIN",
    false
  );
  const adminUser = await ensureUser(
    credentials.adminEmail,
    credentials.adminPassword,
    "ADMIN",
    true
  );
  const employeeUser = await ensureUser(
    credentials.employeeEmail,
    credentials.employeePassword,
    "EMPLOYEE",
    true
  );

  const people = await ensureDepartment("People Operations", "Human resources and workforce operations.");
  const engineering = await ensureDepartment("Engineering", "Product and software engineering.");

  const adminEmployee = await ensureEmployee({
    employeeId: "DEMO-ADM-001",
    name: "Demo Administrator",
    email: credentials.adminEmail,
    designation: "HR Administrator",
    departmentId: people._id,
    userId: adminUser._id
  });
  const employee = await ensureEmployee({
    employeeId: "DEMO-EMP-001",
    name: "Demo Employee",
    email: credentials.employeeEmail,
    designation: "Software Engineer",
    departmentId: engineering._id,
    userId: employeeUser._id,
    managerId: adminEmployee._id
  });

  const now = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const todayCheckIn = new Date(Math.max(today.getTime(), now.getTime() - 60 * 60_000));
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayCheckIn = new Date(yesterday);
  yesterdayCheckIn.setUTCHours(9, 0, 0, 0);
  const yesterdayCheckOut = new Date(yesterday);
  yesterdayCheckOut.setUTCHours(18, 0, 0, 0);

  await ensureAttendance(employee._id, yesterday, yesterdayCheckIn, yesterdayCheckOut);
  await ensureAttendance(employee._id, today, todayCheckIn, null);

  console.log("Demo data is ready (existing records and passwords were preserved).");
  console.log(`Super Admin: ${credentials.bootstrapEmail}`);
  console.log(`Admin: ${credentials.adminEmail} (must change password on first login)`);
  console.log(`Employee: ${credentials.employeeEmail} (must change password on first login)`);
  console.log("Demo passwords are read from apps/api/.env and were not printed.");
} finally {
  await disconnectDatabase();
}
