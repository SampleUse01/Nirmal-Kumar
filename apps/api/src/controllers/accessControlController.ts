import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PERMISSION_KEYS, PERMISSIONS } from "../config/permissions.js";
import { RoleAccess } from "../models/RoleAccess.js";
import { ROLES, User } from "../models/User.js";
import { writeAudit } from "../utils/audit.js";
import { getRolePermissions } from "../utils/rbac.js";
import { HttpError } from "../utils/errors.js";

const passwordSchema = z.string().regex(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/,
  "Use 8-128 characters with uppercase, lowercase, a number, and a special character."
);

export const listRoleAccess: RequestHandler = async (_request, response) => {
  const roles = await Promise.all(ROLES.map(async (role) => ({
    role,
    permissions: await getRolePermissions(role),
    configurable: role !== "SUPER_ADMIN"
  })));
  response.json({
    roles,
    permissionCatalog: PERMISSION_KEYS.map((key) => ({ key, label: PERMISSIONS[key] }))
  });
};

export const updateRoleAccess: RequestHandler = async (request, response) => {
  const role = z.enum(ROLES).parse(request.params.role);
  if (role === "SUPER_ADMIN") throw new HttpError(400, "Super Admin permissions are fixed and cannot be reduced.");
  const { permissions } = z.object({
    permissions: z.array(z.enum(PERMISSION_KEYS)).max(PERMISSION_KEYS.length)
  }).parse(request.body);
  const uniquePermissions = [...new Set(permissions)];
  await RoleAccess.findOneAndUpdate(
    { role },
    { $set: { role, permissions: uniquePermissions } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await writeAudit({
    userId: request.authUser!.id,
    role: request.authUser!.role,
    action: "PERMISSION_CHANGE",
    module: "RBAC",
    description: `Updated ${role} permission configuration (${uniquePermissions.length} permissions).`,
    ipAddress: request.ip
  });
  response.json({ role, permissions: uniquePermissions });
};

export const listAdminAccounts: RequestHandler = async (_request, response) => {
  const admins = await User.find({ role: "ADMIN" })
    .select("email active mustChangePassword createdAt")
    .sort({ createdAt: -1 });
  response.json({ admins });
};

export const createAdminAccount: RequestHandler = async (request, response) => {
  const input = z.object({
    email: z.string().email().max(254).transform((email) => email.toLowerCase()),
    password: passwordSchema,
    confirmPassword: z.string().min(1).max(128)
  }).refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  }).parse(request.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const admin = await User.create({
    email: input.email,
    passwordHash,
    role: "ADMIN",
    mustChangePassword: true
  });
  await writeAudit({
    userId: request.authUser!.id,
    role: request.authUser!.role,
    action: "CREATE",
    module: "ADMIN_MANAGEMENT",
    description: `Created Admin account ${admin.email}.`,
    ipAddress: request.ip
  });
  response.status(201).json({
    admin: {
      id: admin.id, email: admin.email, role: admin.role,
      active: admin.active, mustChangePassword: admin.mustChangePassword
    }
  });
};

export const updateAdminAccountStatus: RequestHandler = async (request, response) => {
  const { active } = z.object({ active: z.boolean() }).parse(request.body);
  const admin = await User.findOneAndUpdate(
    { _id: request.params.id, role: "ADMIN" },
    { $set: { active }, $inc: { tokenVersion: 1 } },
    { new: true }
  ).select("email role active");
  if (!admin) throw new HttpError(404, "Admin account not found.");
  await writeAudit({
    userId: request.authUser!.id,
    role: request.authUser!.role,
    action: active ? "RESTORE" : "DEACTIVATE",
    module: "ADMIN_MANAGEMENT",
    description: `${active ? "Reactivated" : "Deactivated"} Admin account ${admin.email}.`,
    ipAddress: request.ip
  });
  response.json({ admin });
};
