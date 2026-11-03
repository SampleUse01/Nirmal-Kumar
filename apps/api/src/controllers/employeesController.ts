import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/errors.js";
import { getDateRange, toCsv } from "../utils/dateFilters.js";

const employeeSchema = z.object({
  employeeId: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254).transform((email) => email.toLowerCase()),
  initialPassword: z.string().regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/,
    "Use 8-128 characters with uppercase, lowercase, a number, and a special character."
  ),
  confirmInitialPassword: z.string().min(1).max(128),
  phone: z.string().trim().max(30).optional(),
  departmentId: z.union([z.literal(""), z.string().regex(/^[a-f\d]{24}$/i)]).nullable().optional()
    .transform((value) => value === "" ? null : value),
  designation: z.string().trim().max(100).optional(),
  managerId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  joiningDate: z.coerce.date().nullable().optional(),
  address: z.string().trim().max(500).optional()
});
const employeeCreateSchema = employeeSchema.refine(
  (value) => value.initialPassword === value.confirmInitialPassword,
  { path: ["confirmInitialPassword"], message: "Temporary passwords do not match." }
);
const employeeUpdateSchema = employeeSchema.partial().omit({
  initialPassword: true, confirmInitialPassword: true
}).extend({ active: z.boolean().optional() });

export const listEmployees: RequestHandler = async (request, response) => {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
  const filter: Record<string, unknown> = {};
  if (request.authUser!.role === "EMPLOYEE") filter.userId = request.authUser!.id;
  if (request.query.active === "true") filter.active = true;
  if (request.query.active === "false") filter.active = false;
  const createdAt = getDateRange(request.query);
  if (createdAt) filter.createdAt = createdAt;
  if (typeof request.query.departmentId === "string" && /^[a-f\d]{24}$/i.test(request.query.departmentId)) {
    filter.departmentId = request.query.departmentId;
  }
  if (typeof request.query.search === "string" && request.query.search.trim()) {
    const escaped = request.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { employeeId: { $regex: escaped, $options: "i" } }
    ];
  }
  const [employees, total] = await Promise.all([
    Employee.find(filter).populate("departmentId", "name")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Employee.countDocuments(filter)
  ]);
  response.json({ employees, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const exportEmployees: RequestHandler = async (request, response) => {
  const filter: Record<string, unknown> = {};
  if (request.query.active === "true") filter.active = true;
  if (request.query.active === "false") filter.active = false;
  if (typeof request.query.departmentId === "string" && /^[a-f\d]{24}$/i.test(request.query.departmentId)) {
    filter.departmentId = request.query.departmentId;
  }
  if (typeof request.query.search === "string" && request.query.search.trim()) {
    const escaped = request.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { employeeId: { $regex: escaped, $options: "i" } }
    ];
  }
  const createdAt = getDateRange(request.query);
  if (createdAt) filter.createdAt = createdAt;
  const employees = await Employee.find(filter).populate("departmentId", "name").sort({ createdAt: -1 });
  const csv = toCsv(
    ["employeeId", "name", "email", "phone", "department", "designation", "joiningDate", "active", "createdAt"],
    employees.map((employee) => [
      employee.employeeId, employee.name, employee.email, employee.phone,
      (employee.departmentId as unknown as { name?: string } | null)?.name,
      employee.designation, employee.joiningDate, employee.active, employee.createdAt
    ])
  );
  response.type("text/csv").attachment("employees.csv").send(csv);
};

export const importEmployees: RequestHandler = async (request, response) => {
  const { rows } = z.object({
    rows: z.array(z.object({
      employeeId: z.string().max(100).optional(),
      name: z.string().max(200).optional(),
      email: z.string().max(254).optional(),
      phone: z.string().max(30).optional(),
      department: z.string().max(100).optional(),
      designation: z.string().max(100).optional(),
      joiningDate: z.string().max(100).optional(),
      initialPassword: z.string().max(128).optional()
    }).passthrough()).max(1000)
  }).parse(request.body);
  const seenEmails = new Set<string>();
  const seenIds = new Set<string>();
  const results: Array<{ row: number; status: "imported" | "failed"; employeeId?: string; email?: string; errors: string[] }> = [];
  for (const [index, row] of rows.entries()) {
    const errors: string[] = [];
    const email = row.email?.trim().toLowerCase() ?? "";
    const employeeId = row.employeeId?.trim() ?? "";
    if (!employeeId) errors.push("Employee ID is required.");
    if (!row.name?.trim()) errors.push("Name is required.");
    if (!z.string().email().safeParse(email).success) errors.push("A valid email is required.");
    if (!row.initialPassword || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/.test(row.initialPassword)) {
      errors.push("Initial password must be 8-128 characters with uppercase, lowercase, a number, and a special character.");
    }
    if (seenEmails.has(email)) errors.push("Duplicate email in this file.");
    if (seenIds.has(employeeId)) errors.push("Duplicate employee ID in this file.");
    seenEmails.add(email);
    seenIds.add(employeeId);
    if (email && await User.exists({ email })) errors.push("An account with this email already exists.");
    if (employeeId && await Employee.exists({ employeeId })) errors.push("Employee ID already exists.");
    let departmentId: string | null = null;
    const departmentName = row.department?.trim() ?? "";
    if (departmentName) {
      const escapedDepartment = departmentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const department = await Department.findOne({
        name: { $regex: `^${escapedDepartment}$`, $options: "i" },
      });
      if (department?.active) departmentId = department.id;
      else if (department) errors.push(`Department "${departmentName}" is archived. Restore it before importing employees into it.`);
    }
    let joiningDate: Date | null = null;
    if (row.joiningDate?.trim()) {
      const parsed = new Date(row.joiningDate);
      if (Number.isNaN(parsed.getTime())) errors.push("Joining date is invalid.");
      else joiningDate = parsed;
    }
    if (errors.length) {
      results.push({ row: index + 2, status: "failed", employeeId, email, errors });
      continue;
    }
    if (departmentName && !departmentId) {
      try {
        const department = await Department.create({ name: departmentName });
        departmentId = department.id;
      } catch (error) {
        results.push({
          row: index + 2, status: "failed", employeeId, email,
          errors: [error instanceof Error && "code" in error && error.code === 11000
            ? `Department "${departmentName}" already exists. Refresh and retry the import.`
            : `Could not create department "${departmentName}". Check the department data and retry.`]
        });
        continue;
      }
    }
    const passwordHash = await bcrypt.hash(row.initialPassword!, 12);
    let userId: string;
    try {
      const user = await User.create({
        email,
        passwordHash,
        role: "EMPLOYEE",
        mustChangePassword: true
      });
      userId = user.id;
    } catch (error) {
      results.push({
        row: index + 2, status: "failed", employeeId, email,
        errors: [error instanceof Error && "code" in error && error.code === 11000
          ? "An account with this email already exists."
          : "Could not create the employee login account."]
      });
      continue;
    }
    try {
      await Employee.create({
        employeeId,
        name: row.name!.trim(),
        email,
        phone: row.phone?.trim() ?? "",
        departmentId,
        designation: row.designation?.trim() ?? "",
        joiningDate,
        userId
      });
      results.push({ row: index + 2, status: "imported", employeeId, email, errors: [] });
    } catch (error) {
      try {
        await User.findByIdAndDelete(userId);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Employee import failed and account cleanup also failed.");
      }
      results.push({
        row: index + 2, status: "failed", employeeId, email,
        errors: [error instanceof Error && error.name === "ValidationError" ? error.message : "Could not create employee. Check for duplicate data."]
      });
    }
  }
  response.status(200).json({ results, imported: results.filter((item) => item.status === "imported").length, failed: results.filter((item) => item.status === "failed").length });
};

export const createEmployee: RequestHandler = async (request, response) => {
  const input = employeeCreateSchema.parse(request.body);
  if (input.departmentId && !(await Department.exists({ _id: input.departmentId, active: true }))) {
    throw new HttpError(400, "The selected department does not exist or is inactive.");
  }
  if (input.managerId && !(await Employee.exists({ _id: input.managerId, active: true }))) {
    throw new HttpError(400, "The selected manager does not exist or is inactive.");
  }
  const { initialPassword, confirmInitialPassword: _confirmInitialPassword, ...employeeInput } = input;
  const user = await User.create({
    email: employeeInput.email,
    passwordHash: await bcrypt.hash(initialPassword, 12),
    role: "EMPLOYEE",
    mustChangePassword: true
  });
  try {
    const employee = await Employee.create({ ...employeeInput, userId: user.id });
    response.status(201).json({ employee });
  } catch (error) {
    try {
      await User.findByIdAndDelete(user.id);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Employee creation failed and the new account could not be rolled back."
      );
    }
    throw error;
  }
};

export const getEmployee: RequestHandler = async (request, response) => {
  const employee = await Employee.findById(request.params.id).populate("departmentId", "name");
  if (!employee) {
    response.status(404).json({ message: "Employee not found." });
    return;
  }
  if (request.authUser!.role === "EMPLOYEE" && employee.userId?.toString() !== request.authUser!.id) {
    response.status(403).json({ message: "You do not have permission to view this employee." });
    return;
  }
  response.json({ employee });
};

export const updateEmployee: RequestHandler = async (request, response) => {
  const input = employeeUpdateSchema.parse(request.body);
  if (input.departmentId && !(await Department.exists({ _id: input.departmentId, active: true }))) {
    throw new HttpError(400, "The selected department does not exist or is inactive.");
  }
  if (input.managerId && !(await Employee.exists({ _id: input.managerId, active: true }))) {
    throw new HttpError(400, "The selected manager does not exist or is inactive.");
  }
  const employee = await Employee.findById(request.params.id);
  if (!employee) {
    response.status(404).json({ message: "Employee not found." });
    return;
  }
  const accountChanges: Record<string, unknown> = {};
  if (input.email && input.email !== employee.email) accountChanges.email = input.email;
  if (input.active !== undefined && input.active !== employee.active) accountChanges.active = input.active;
  const accountChanged = Boolean(employee.userId && Object.keys(accountChanges).length);
  const previousAccount = { email: employee.email, active: employee.active };
  if (accountChanged) {
    const accountUpdate = Object.hasOwn(accountChanges, "active")
      ? { $set: accountChanges, $inc: { tokenVersion: 1 } }
      : { $set: accountChanges };
    const account = await User.findByIdAndUpdate(employee.userId, accountUpdate, { new: true });
    if (!account) throw new HttpError(409, "The employee login account could not be found.");
  }
  Object.assign(employee, input);
  try {
    await employee.save();
  } catch (error) {
    if (accountChanged) {
      try {
        await User.findByIdAndUpdate(employee.userId, previousAccount);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "Employee update failed and the linked account could not be rolled back.");
      }
    }
    throw error;
  }
  response.json({ employee });
};

export const deactivateEmployee: RequestHandler = async (request, response) => {
  const employee = await Employee.findById(request.params.id);
  if (!employee) {
    response.status(404).json({ message: "Employee not found." });
    return;
  }
  const previousActive = employee.active;
  if (employee.userId) {
    const account = await User.findByIdAndUpdate(
      employee.userId,
      { $set: { active: false }, $inc: { tokenVersion: 1 } },
      { new: true }
    );
    if (!account) throw new HttpError(409, "The employee login account could not be found.");
  }
  employee.active = false;
  try {
    await employee.save();
  } catch (error) {
    if (employee.userId) {
      try {
        await User.findByIdAndUpdate(employee.userId, { active: previousActive });
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "Employee deactivation failed and the linked account could not be restored.");
      }
    }
    throw error;
  }
  response.json({ employee });
};
