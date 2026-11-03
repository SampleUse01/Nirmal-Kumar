import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, Clock3, Users, UserRoundCheck } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import type { Attendance, Employee, User } from "../types";
import { DateRangeFilter, type DateRangeParams } from "../components/DateRangeFilter";
import { downloadCsv } from "../lib/downloadCsv";
import { useToast } from "../components/ToastProvider";
import { useState } from "react";

const formatTime = (date: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(date));

export function DashboardPage({ user }: { user: User }) {
  const toast = useToast();
  const [dateRange, setDateRange] = useState<DateRangeParams>({ preset: "today" });
  const isAdmin = user.role !== "EMPLOYEE";
  const canViewEmployees = user.role === "SUPER_ADMIN" || user.permissions?.includes("EMPLOYEES_VIEW") === true;
  const canViewTeamAttendance = user.role === "SUPER_ADMIN" || user.permissions?.includes("ATTENDANCE_TEAM") === true;
  const { data: employeesData } = useQuery({
    queryKey: ["employees", "dashboard"],
    queryFn: async () => (await api.get<{ employees: Employee[]; pagination: { total: number } }>("/employees?active=true&limit=1")).data,
    enabled: isAdmin && canViewEmployees
  });
  const { data: attendanceData } = useQuery({
    queryKey: ["attendance", "today", user.role],
    queryFn: async () => {
      const { data } = await api.get<{ attendance?: Attendance | null; attendances?: Attendance[] }>("/attendance/today");
      return data;
    },
    enabled: !isAdmin || canViewTeamAttendance
  });
  const { data: attendanceSummary, error: attendanceSummaryError } = useQuery({
    queryKey: ["attendance", "summary", dateRange, user.role],
    queryFn: async () => (await api.get<{
      summary: { totalRecords: number; completedRecords: number; ongoingRecords: number; workingMinutes: number; overtimeMinutes: number };
      attendances: Attendance[];
    }>("/attendance/summary", { params: dateRange })).data,
    enabled: isAdmin ? canViewTeamAttendance : user.permissions?.includes("ATTENDANCE_SELF") === true
  });
  const employeeAttendance = attendanceData?.attendance;
  const teamAttendance = attendanceSummary?.attendances ?? attendanceData?.attendances ?? [];
  const attendanceTotals = attendanceSummary?.summary;
  const cards = isAdmin
    ? [
        { label: "Active employees", value: employeesData?.pagination.total ?? "—", icon: Users, tone: "text-indigo-600 bg-indigo-50" },
        { label: "Attendance records", value: attendanceTotals?.totalRecords ?? "—", icon: UserRoundCheck, tone: "text-emerald-600 bg-emerald-50" },
        { label: "Completed records", value: attendanceTotals?.completedRecords ?? "—", icon: Clock3, tone: "text-amber-600 bg-amber-50" },
        { label: "Working hours", value: attendanceTotals ? `${Math.floor(attendanceTotals.workingMinutes / 60)}h ${attendanceTotals.workingMinutes % 60}m` : "—", icon: Activity, tone: "text-violet-600 bg-violet-50" }
      ]
    : [
        { label: "Attendance records", value: attendanceTotals?.totalRecords ?? "—", icon: UserRoundCheck, tone: "text-emerald-600 bg-emerald-50" },
        { label: "Working hours", value: attendanceTotals ? `${Math.floor(attendanceTotals.workingMinutes / 60)}h ${attendanceTotals.workingMinutes % 60}m` : "—", icon: Clock3, tone: "text-amber-600 bg-amber-50" }
      ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">Workspace overview</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-muted">A snapshot of what is happening across your team.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-sm">
          {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {(isAdmin ? canViewTeamAttendance : user.permissions?.includes("ATTENDANCE_SELF") === true) && <div className="flex flex-wrap gap-2"><button onClick={() => void downloadCsv("/attendance/summary/export", dateRange, "dashboard-summary.csv").catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Export failed."))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Export dashboard CSV</button><button onClick={() => void downloadCsv("/attendance/export", dateRange, "attendance.csv").catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Export failed."))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Export attendance CSV</button></div>}
      </div>
      {attendanceSummaryError && <p role="alert" className="mb-4 text-sm text-rose-600">{getErrorMessage(attendanceSummaryError)}</p>}
      <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <section key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></span>
              <ArrowUpRight size={17} className="text-slate-300" />
            </div>
            <p className="mt-5 text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          </section>
        ))}
      </div>
      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold">{isAdmin ? "Attendance in selected range" : "Today&apos;s attendance"}</h2>
            <p className="mt-1 text-xs text-muted">{isAdmin ? "Latest team records matching the selected dates" : "Your check-in status"}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{isAdmin ? "Filtered" : "Live"}</span>
        </div>
        {!isAdmin ? (
          <div className="p-6 text-sm text-slate-600">
            {employeeAttendance
              ? <>Checked in at <strong>{formatTime(employeeAttendance.checkInAt)}</strong>{employeeAttendance.checkOutAt ? ` · checked out at ${formatTime(employeeAttendance.checkOutAt)}` : " · your shift is in progress"}</>
              : "No attendance has been recorded for today yet. Open Attendance to check in."}
          </div>
        ) : teamAttendance.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-400"><tr><th className="px-6 py-3">Employee</th><th className="px-6 py-3">Check in</th><th className="px-6 py-3">Check out</th><th className="px-6 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {teamAttendance.slice(0, 6).map((record) => (
                  <tr key={record._id}>
                    <td className="px-6 py-4 font-medium">{record.employeeId?.name ?? "Employee"}</td>
                    <td className="px-6 py-4 text-slate-600">{formatTime(record.checkInAt)}</td>
                    <td className="px-6 py-4 text-slate-600">{record.checkOutAt ? formatTime(record.checkOutAt) : "—"}</td>
                    <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${record.checkOutAt ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{record.checkOutAt ? "Complete" : "Working"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-6 py-10 text-center text-sm text-muted">No team attendance has been recorded today.</p>}
      </section>
    </div>
  );
}
