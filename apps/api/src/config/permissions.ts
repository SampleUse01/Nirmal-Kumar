import type { Role } from "../models/User.js";

export const PERMISSIONS = {
  DASHBOARD_VIEW: "View dashboard",
  EMPLOYEES_VIEW: "View employees",
  EMPLOYEES_MANAGE: "Manage employees",
  DEPARTMENTS_VIEW: "View departments",
  DEPARTMENTS_MANAGE: "Manage departments",
  ATTENDANCE_SELF: "View and record own attendance",
  ATTENDANCE_TEAM: "View team attendance",
  WORK_REQUESTS_SUBMIT: "Submit own requests",
  WORK_REQUESTS_VIEW: "View requests",
  WORK_REQUESTS_REVIEW: "Review requests",
  NOTIFICATIONS_VIEW: "View own notifications",
  NOTIFICATIONS_MANAGE: "Manage own notifications",
  PROFILE_MANAGE: "Manage own profile",
  AUDIT_VIEW: "View audit logs",
  ROLE_MANAGE: "Manage role permissions",
  ADMIN_MANAGE: "Manage admin accounts"
} as const;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Array<keyof typeof PERMISSIONS>;
export type PermissionKey = keyof typeof PERMISSIONS;

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_KEYS,
  ADMIN: [
    "DASHBOARD_VIEW", "EMPLOYEES_VIEW", "EMPLOYEES_MANAGE", "DEPARTMENTS_VIEW",
    "DEPARTMENTS_MANAGE", "ATTENDANCE_SELF", "ATTENDANCE_TEAM", "WORK_REQUESTS_VIEW",
    "WORK_REQUESTS_REVIEW", "NOTIFICATIONS_VIEW", "NOTIFICATIONS_MANAGE", "PROFILE_MANAGE"
  ],
  EMPLOYEE: [
    "DASHBOARD_VIEW", "ATTENDANCE_SELF", "WORK_REQUESTS_SUBMIT", "WORK_REQUESTS_VIEW",
    "NOTIFICATIONS_VIEW", "NOTIFICATIONS_MANAGE", "PROFILE_MANAGE"
  ]
};
