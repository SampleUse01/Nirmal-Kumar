import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  ChevronDown,
  FileClock,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { PermissionKey, User } from "../types";
import { ThemeToggle } from "./ThemeToggle";
import { useToast } from "./ToastProvider";

function getNavigation(user: User) {
  const items: { to: string; label: string; icon: LucideIcon; permission: PermissionKey; end?: boolean }[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, permission: "DASHBOARD_VIEW", end: true },
    {
      to: "/attendance",
      label: user.role === "EMPLOYEE" ? "My attendance" : "Attendance",
      icon: CalendarCheck2,
      permission: user.role === "EMPLOYEE" ? "ATTENDANCE_SELF" : "ATTENDANCE_TEAM"
    }
  ];
  if (user.role !== "EMPLOYEE") {
    items.push(
      { to: "/employees", label: "Employees", icon: Users, permission: "EMPLOYEES_VIEW" },
      { to: "/departments", label: "Departments", icon: Building2, permission: "DEPARTMENTS_VIEW" }
    );
  }
  items.push(
    { to: "/requests/LEAVE", label: user.role === "EMPLOYEE" ? "Leave requests" : "Leave management", icon: ClipboardCheck, permission: "WORK_REQUESTS_VIEW" },
    { to: "/requests/PERMISSION", label: "Permission requests", icon: FileClock, permission: "WORK_REQUESTS_VIEW" },
    { to: "/requests/OVERTIME", label: "Overtime requests", icon: FileClock, permission: "WORK_REQUESTS_VIEW" },
    { to: "/requests/REGULARIZATION", label: "Attendance regularization", icon: CalendarCheck2, permission: "WORK_REQUESTS_VIEW" },
    { to: "/notifications", label: "Notifications", icon: Bell, permission: "NOTIFICATIONS_VIEW" }
  );
  if (user.role === "SUPER_ADMIN") {
    items.push(
      { to: "/audit-logs", label: "Audit logs", icon: ShieldCheck, permission: "AUDIT_VIEW" },
      { to: "/access-control", label: "Roles & access", icon: ShieldCheck, permission: "ROLE_MANAGE" }
    );
  }
  items.push({ to: "/profile", label: "Profile", icon: UserRound, permission: "PROFILE_MANAGE" });
  return items.filter(({ permission }) => user.role === "SUPER_ADMIN" || user.permissions?.includes(permission));
}

export function AppLayout({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const navItems = getNavigation(user);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.post("/auth/logout");
      queryClient.clear();
      toast.success("You have been signed out.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error("Sign out failed. Please try again.");
      console.error("Sign out failed.", error);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-slate-200/80 bg-white px-5 py-6 md:flex">
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-lg font-bold text-white">W</div>
          <div>
            <p className="font-bold tracking-tight">Workforce</p>
            <p className="text-xs text-muted">People operations</p>
          </div>
        </div>
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-indigo-50 text-brand" : "text-slate-500 hover:bg-slate-50 hover:text-ink"
                }`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-[5] flex min-h-[68px] items-center justify-between gap-3 border-b border-slate-200/70 bg-white/85 px-4 py-2 backdrop-blur sm:px-5 md:px-10">
          <div className="hidden text-sm text-muted sm:block">Good day, <span className="font-semibold text-ink">{user.employee?.name?.split(" ")[0] ?? "there"}</span></div>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 lg:inline-flex">Workspace active</span>
            <div className="relative" ref={accountMenuRef}>
              <button
                ref={accountButtonRef}
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-controls="account-menu"
                className="flex max-w-[min(52vw,280px)] items-center gap-2 rounded-xl px-1.5 py-1 text-left transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand dark:hover:bg-slate-800 sm:gap-3 sm:px-2"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-brand">
                  {(user.employee?.name ?? user.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="max-w-[180px] truncate text-sm font-semibold text-ink">{user.employee?.name ?? user.email}</span>
                  <span className="max-w-[180px] truncate text-[10px] font-medium uppercase tracking-wide text-muted">{user.email} · {user.role.replaceAll("_", " ")}</span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-muted transition-transform duration-200 ${accountMenuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {accountMenuOpen && (
                  <motion.div
                    id="account-menu"
                    role="menu"
                    aria-label="Account options"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-30 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-700">
                      <p className="truncate text-sm font-semibold text-ink">{user.employee?.name ?? user.email}</p>
                      <p className="mt-1 truncate text-xs text-muted">{user.email}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-brand">{user.role.replaceAll("_", " ")}</p>
                    </div>
                    <NavLink
                      to="/profile"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <UserRound size={17} />
                      Profile
                    </NavLink>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void logout()}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:cursor-wait disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950"
                    >
                      <LogOut size={17} />
                      {loggingOut ? "Signing out..." : "Sign out"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mx-auto max-w-[1400px] px-5 py-8 md:px-10 md:py-10"
        >
          <Outlet />
        </motion.div>
        <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-start gap-2 overflow-x-auto border-t bg-white p-2 md:hidden">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-w-[60px] flex-none flex-col items-center gap-1 px-2 py-1 text-[10px] ${isActive ? "text-brand" : "text-slate-400"}`}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}
