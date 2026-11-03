export type Role = "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE";
export type PermissionKey =
  | "DASHBOARD_VIEW"
  | "EMPLOYEES_VIEW"
  | "EMPLOYEES_MANAGE"
  | "DEPARTMENTS_VIEW"
  | "DEPARTMENTS_MANAGE"
  | "ATTENDANCE_SELF"
  | "ATTENDANCE_TEAM"
  | "WORK_REQUESTS_SUBMIT"
  | "WORK_REQUESTS_VIEW"
  | "WORK_REQUESTS_REVIEW"
  | "NOTIFICATIONS_VIEW"
  | "NOTIFICATIONS_MANAGE"
  | "PROFILE_MANAGE"
  | "AUDIT_VIEW"
  | "ROLE_MANAGE"
  | "ADMIN_MANAGE";

export interface User {
  id: string;
  email: string;
  role: Role;
  permissions?: PermissionKey[];
  mustChangePassword?: boolean;
  employee?: { employeeId: string; name: string } | null;
}

export interface Department {
  _id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  departmentId: Department | null;
  active: boolean;
}

export interface Attendance {
  _id: string;
  workDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  workingMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  employeeId?: Pick<Employee, "employeeId" | "name">;
}
