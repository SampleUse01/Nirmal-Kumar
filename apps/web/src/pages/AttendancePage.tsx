import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CircleArrowDown, CircleArrowUp, Search } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import type { Attendance, User } from "../types";
import { useToast } from "../components/ToastProvider";
import { DateRangeFilter, type DateRangeParams } from "../components/DateRangeFilter";
import { downloadCsv } from "../lib/downloadCsv";
import { useState } from "react";

const displayTime = (time?: string | null) => time
  ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(time))
  : "—";

export function AttendancePage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user.role !== "EMPLOYEE";
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeParams>({ preset: "7d" });
  const { data: todayData, isLoading: todayLoading, error: todayError } = useQuery({
    queryKey: ["attendance", "today", user.role],
    queryFn: async () => (await api.get<{ attendance?: Attendance | null }>("/attendance/today")).data,
    enabled: !isAdmin
  });
  const { data: attendanceData, isLoading, error } = useQuery({
    queryKey: ["attendance", "list", dateRange, search, user.role],
    queryFn: async () => (await api.get<{ attendances: Attendance[] }>("/attendance", {
      params: { ...dateRange, search, limit: 100 }
    })).data
  });
  const record = todayData?.attendance;
  const action = useMutation({
    mutationFn: async (kind: "check-in" | "check-out") => api.post(`/attendance/${kind}`),
    onSuccess: (_result, kind) => {
      toast.success(kind === "check-in" ? "You are checked in." : "Your attendance has been checked out.");
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });
  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return (
    <div>
      <div className="mb-7"><p className="text-sm font-medium text-brand">Time and presence</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Attendance</h1><p className="mt-2 text-sm text-muted">A clear record of today&apos;s check-ins and working hours.</p></div>
      {!isAdmin && <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8"><div className="flex flex-wrap items-start justify-between gap-6"><div><div className="flex items-center gap-2 text-sm font-medium text-muted"><CalendarClock size={17} />{date}</div><h2 className="mt-3 text-xl font-semibold">Your workday</h2><p className="mt-1 text-sm text-muted">{todayError ? getErrorMessage(todayError) : record?.checkInAt ? `Checked in at ${displayTime(record.checkInAt)}` : "You have not checked in yet."}{record?.checkOutAt ? ` · Checked out at ${displayTime(record.checkOutAt)}` : record?.checkInAt ? " · currently working" : ""}</p></div><div className="flex gap-2">{!record ? <button disabled={action.isPending || todayLoading} onClick={() => action.mutate("check-in")} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"><CircleArrowUp size={17} />Check in</button> : !record.checkOutAt ? <button disabled={action.isPending} onClick={() => action.mutate("check-out")} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"><CircleArrowDown size={17} />Check out</button> : <span className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">Day complete</span>}</div></div></section>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isAdmin ? "Search employee..." : "Search attendance..."} className="field pl-9" /></label>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
        <button onClick={() => void downloadCsv("/attendance/export", { ...dateRange, search }, "attendance.csv").catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Export failed."))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Export CSV</button>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">{isAdmin ? "Team attendance" : "Attendance history"}</h2><p className="mt-1 text-xs text-muted">Times and shift calculations use UTC and a 09:00–18:00 general-shift baseline.</p></div>{isLoading ? <p className="p-8 text-center text-sm text-muted">Loading attendance...</p> : error ? <p role="alert" className="p-8 text-center text-sm text-rose-600">{getErrorMessage(error)}</p> : attendanceData?.attendances.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Date</th>{isAdmin && <th className="px-5 py-3">Employee</th>}<th className="px-5 py-3">Check in</th><th className="px-5 py-3">Check out</th><th className="px-5 py-3">Work time</th><th className="px-5 py-3">Late</th><th className="px-5 py-3">Overtime</th></tr></thead><tbody className="divide-y divide-slate-100">{attendanceData.attendances.map((attendance) => <tr key={attendance._id}><td className="px-5 py-4">{attendance.workDate ? new Date(attendance.workDate).toLocaleDateString() : "—"}</td>{isAdmin && <td className="px-5 py-4 font-medium">{attendance.employeeId?.name ?? "Employee"}</td>}<td className="px-5 py-4">{displayTime(attendance.checkInAt)}</td><td className="px-5 py-4">{displayTime(attendance.checkOutAt)}</td><td className="px-5 py-4">{attendance.workingMinutes ? `${Math.floor(attendance.workingMinutes / 60)}h ${attendance.workingMinutes % 60}m` : "—"}</td><td className="px-5 py-4">{attendance.lateMinutes ? `${attendance.lateMinutes}m` : "—"}</td><td className="px-5 py-4">{attendance.overtimeMinutes ? `${attendance.overtimeMinutes}m` : "—"}</td></tr>)}</tbody></table></div> : <p className="p-10 text-center text-sm text-muted">No attendance matches this date range and search.</p>}</section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 font-semibold">{value}</p></div>;
}
