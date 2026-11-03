import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getErrorMessage } from "../lib/api";
import { DateRangeFilter, type DateRangeParams } from "../components/DateRangeFilter";
import { downloadCsv } from "../lib/downloadCsv";
import { useToast } from "../components/ToastProvider";

interface AuditLog {
  _id: string;
  role: string;
  action: string;
  module: string;
  description: string;
  ipAddress: string;
  createdAt: string;
  userId?: { email: string };
}

export function AuditLogsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeParams>({ preset: "7d" });
  const filters = { ...dateRange, search };
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => (await api.get<{ logs: AuditLog[]; pagination: { total: number } }>("/audit-logs", { params: { ...filters, limit: 100 } })).data
  });
  return <div>
    <header className="mb-7"><p className="text-sm font-medium text-brand">System oversight</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Audit logs</h1><p className="mt-2 text-sm text-muted">Recent workflow submissions and approval decisions.</p></header>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3"><input aria-label="Search audit logs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, module, description..." className="field w-full sm:w-80" /><DateRangeFilter value={dateRange} onChange={setDateRange} /></div>
      <button onClick={() => void downloadCsv("/audit-logs/export", filters, "audit-logs.csv").catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Export failed."))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Export CSV</button>
    </div>
    {error ? <p role="alert" className="text-sm text-rose-600">{getErrorMessage(error)}</p> : isLoading ? <p className="text-sm text-muted">Loading audit logs...</p> : data?.logs.length ? <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-card"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Module</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">IP address</th></tr></thead><tbody className="divide-y divide-slate-100">{data.logs.map((log) => <tr key={log._id}><td className="whitespace-nowrap px-5 py-4">{new Date(log.createdAt).toLocaleString()}</td><td className="px-5 py-4">{log.userId?.email ?? "Deleted account"}<span className="mt-1 block text-xs text-muted">{log.role.replaceAll("_", " ")}</span></td><td className="px-5 py-4 font-medium">{log.action}</td><td className="px-5 py-4">{log.module}</td><td className="max-w-md px-5 py-4">{log.description}</td><td className="px-5 py-4">{log.ipAddress || "—"}</td></tr>)}</tbody></table><p className="border-t border-slate-100 px-5 py-3 text-xs text-muted">Showing {data.logs.length} of {data.pagination.total} logged events.</p></div> : <p className="text-sm text-muted">No audit records are available.</p>}
  </div>;
}
