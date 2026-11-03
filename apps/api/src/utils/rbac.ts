import { RoleAccess } from "../models/RoleAccess.js";
import { type Role, ROLES } from "../models/User.js";
import { DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from "../config/permissions.js";

export async function getRolePermissions(role: Role): Promise<PermissionKey[]> {
  if (!ROLES.includes(role)) return [];
  if (role === "SUPER_ADMIN") return [...DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN];
  const configured = await RoleAccess.findOne({ role }).select("permissions").lean();
  return configured ? configured.permissions as PermissionKey[] : [...DEFAULT_ROLE_PERMISSIONS[role]];
}

export async function roleHasPermission(role: Role, permission: PermissionKey): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  return (await getRolePermissions(role)).includes(permission);
}
