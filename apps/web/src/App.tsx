import { Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import type { User } from "./types";
import { LoadingScreen } from "./components/LoadingScreen";

const AppLayout = lazy(() => import("./components/AppLayout").then((module) => ({ default: module.AppLayout })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage").then((module) => ({ default: module.EmployeesPage })));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage").then((module) => ({ default: module.DepartmentsPage })));
const AttendancePage = lazy(() => import("./pages/AttendancePage").then((module) => ({ default: module.AttendancePage })));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage").then((module) => ({ default: module.ChangePasswordPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const RequestsPage = lazy(() => import("./pages/RequestsPage").then((module) => ({ default: module.RequestsPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage").then((module) => ({ default: module.AuditLogsPage })));
const AccessControlPage = lazy(() => import("./pages/AccessControlPage").then((module) => ({ default: module.AccessControlPage })));

function NoPermissionPage() {
  return <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"><h1 className="text-xl font-semibold">No dashboard access</h1><p className="mt-2 text-sm text-muted">Your account currently has no permission to open this page. Contact your Super Admin.</p></section>;
}

function ProtectedRoutes() {
  const { data, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await api.get<{ user: User }>("/auth/me")).data.user
  });

  if (isLoading) return <LoadingScreen />;
  if (!data) return <Navigate to="/login" replace />;
  if (data.mustChangePassword) return <ChangePasswordPage user={data} />;
  const can = (permission: NonNullable<User["permissions"]>[number]) =>
    data.role === "SUPER_ADMIN" || data.permissions?.includes(permission) === true;
  return (
    <Routes>
      <Route element={<AppLayout user={data} />}>
        <Route index element={can("DASHBOARD_VIEW") ? <DashboardPage user={data} /> : <NoPermissionPage />} />
        <Route path="employees" element={can("EMPLOYEES_VIEW") ? <EmployeesPage user={data} /> : <Navigate to="/" replace />} />
        <Route path="departments" element={can("DEPARTMENTS_VIEW") ? <DepartmentsPage user={data} /> : <Navigate to="/" replace />} />
        <Route path="attendance" element={can(data.role === "EMPLOYEE" ? "ATTENDANCE_SELF" : "ATTENDANCE_TEAM") ? <AttendancePage user={data} /> : <Navigate to="/" replace />} />
        <Route path="requests" element={can("WORK_REQUESTS_VIEW") ? <RequestsPage user={data} /> : <Navigate to="/" replace />} />
        <Route path="requests/:kind" element={can("WORK_REQUESTS_VIEW") ? <RequestsPage user={data} /> : <Navigate to="/" replace />} />
        <Route path="notifications" element={can("NOTIFICATIONS_VIEW") ? <NotificationsPage /> : <Navigate to="/" replace />} />
        <Route path="audit-logs" element={data.role === "SUPER_ADMIN" && can("AUDIT_VIEW") ? <AuditLogsPage /> : <Navigate to="/" replace />} />
        <Route path="access-control" element={data.role === "SUPER_ADMIN" && can("ROLE_MANAGE") && can("ADMIN_MANAGE") ? <AccessControlPage /> : <Navigate to="/" replace />} />
        <Route path="profile" element={can("PROFILE_MANAGE") ? <ProfilePage user={data} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </Suspense>
  );
}
