import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Archive } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { useState } from "react";
import { DateRangeFilter, type DateRangeParams } from "../components/DateRangeFilter";

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  status: "UNREAD" | "READ" | "ARCHIVED";
  createdAt: string;
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeParams>({ preset: "1m" });
  const filters = { ...dateRange, search, ...(status ? { status } : {}) };
  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ["notifications", filters],
    queryFn: async () => (await api.get<{ notifications: NotificationItem[] }>("/notifications", { params: filters })).data.notifications
  });
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "READ" | "ARCHIVED" }) =>
      api.patch(`/notifications/${id}/status`, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });

  return <div>
    <header className="mb-7"><p className="text-sm font-medium text-brand">Updates</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Notifications</h1><p className="mt-2 text-sm text-muted">Request decisions and important account updates.</p></header>
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <input aria-label="Search notifications" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications..." className="field w-full sm:w-72" />
      <select aria-label="Filter notifications by status" value={status} onChange={(event) => setStatus(event.target.value)} className="field w-auto"><option value="">All statuses</option><option value="UNREAD">Unread</option><option value="READ">Read</option><option value="ARCHIVED">Archived</option></select>
      <DateRangeFilter value={dateRange} onChange={setDateRange} />
    </div>
    {error ? <p role="alert" className="text-sm text-rose-600">{getErrorMessage(error)}</p> : isLoading ? <p className="text-sm text-muted">Loading notifications...</p> : notifications.length ? <div className="grid gap-3">{notifications.map((item) => <article key={item._id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className="flex gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.status === "UNREAD" ? "bg-indigo-50 text-brand" : "bg-slate-100 text-slate-500"}`}><Bell size={18} /></span><div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm leading-6 text-muted">{item.message}</p><p className="mt-2 text-xs text-muted">{new Date(item.createdAt).toLocaleString()} · {item.status.toLowerCase()}</p></div></div>
      {item.status !== "ARCHIVED" && <div className="flex gap-3">{item.status === "UNREAD" && <button onClick={() => updateStatus.mutate({ id: item._id, status: "READ" })} className="inline-flex items-center gap-1 text-xs font-medium text-brand"><Check size={14} />Mark read</button>}<button onClick={() => updateStatus.mutate({ id: item._id, status: "ARCHIVED" })} className="inline-flex items-center gap-1 text-xs font-medium text-muted"><Archive size={14} />Archive</button></div>}
    </article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Bell size={24} className="mx-auto text-slate-300" /><p className="mt-3 font-medium">You&apos;re all caught up</p><p className="mt-1 text-sm text-muted">New notifications will appear here.</p></div>}
  </div>;
}
