import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, RotateCcw, X } from "lucide-react";
import { useParams } from "react-router-dom";
import { api, getErrorMessage } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { DateRangeFilter, type DateRangeParams } from "../components/DateRangeFilter";
import type { User } from "../types";

const requestKinds = ["LEAVE", "PERMISSION", "OVERTIME", "REGULARIZATION"] as const;
type RequestKind = (typeof requestKinds)[number];
interface WorkRequest {
  _id: string;
  kind: RequestKind;
  data: Record<string, string | number>;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  reviewedAt?: string;
  reviewReason?: string;
  comments?: string;
  employeeId?: { name: string; employeeId: string };
  reviewedBy?: { email: string };
}
const labels: Record<RequestKind, string> = {
  LEAVE: "Leave",
  PERMISSION: "Permission",
  OVERTIME: "Overtime",
  REGULARIZATION: "Attendance regularization"
};
const inputClass = "field w-full";
const dateOnly = (value: string | number | undefined) =>
  value ? new Date(value).toLocaleDateString() : "—";

export function RequestsPage({ user }: { user: User }) {
  const { kind: routeKind } = useParams();
  const kind = requestKinds.includes(routeKind as RequestKind) ? routeKind as RequestKind : undefined;
  const isEmployee = user.role === "EMPLOYEE";
  const canReview = user.role === "SUPER_ADMIN" || user.permissions?.includes("WORK_REQUESTS_REVIEW") === true;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [reviewError, setReviewError] = useState("");
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeParams>({ preset: "1y" });
  const filters = { ...dateRange, ...(kind ? { kind } : {}), ...(status ? { status } : {}), search };
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["work-requests", filters],
    queryFn: async () => (await api.get<{ requests: WorkRequest[] }>("/work-requests", {
      params: filters
    })).data.requests
  });
  const createRequest = useMutation({
    mutationFn: async (data: Record<string, string | number>) =>
      api.post("/work-requests", { kind, data }),
    onSuccess: () => {
      toast.success(`${labels[kind!]} request submitted.`);
      void queryClient.invalidateQueries({ queryKey: ["work-requests"] });
      (document.getElementById("request-form") as HTMLFormElement | null)?.reset();
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });
  const reviewRequest = useMutation({
    mutationFn: async ({ id, decision, reason }: { id: string; decision: "APPROVED" | "REJECTED"; reason?: string }) =>
      api.post(`/work-requests/${id}/review`, { decision, reason }),
    onSuccess: (_result, variables) => {
      toast.success(`Request ${variables.decision.toLowerCase()}.`);
      setReviewError("");
      void queryClient.invalidateQueries({ queryKey: ["work-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (requestError) => {
      const message = getErrorMessage(requestError);
      setReviewError(message);
      toast.error(message);
    }
  });
  const cancelRequest = useMutation({
    mutationFn: async (id: string) => api.post(`/work-requests/${id}/cancel`),
    onSuccess: () => {
      toast.success("Request cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["work-requests"] });
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });
  const pendingCount = useMemo(() => requests.filter((request) => request.status === "PENDING").length, [requests]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kind) return;
    const form = new FormData(event.currentTarget);
    const data: Record<string, string | number> = Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, value.toString()])
    );
    if (kind === "LEAVE") {
      const start = new Date(`${data.startDate}T00:00:00Z`);
      const end = new Date(`${data.endDate}T00:00:00Z`);
      data.totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    }
    if (kind === "OVERTIME") data.extraHours = Number(data.extraHours);
    if (kind === "REGULARIZATION") {
      if (data.checkInAt) data.checkInAt = new Date(data.checkInAt).toISOString();
      else delete data.checkInAt;
      if (data.checkOutAt) data.checkOutAt = new Date(data.checkOutAt).toISOString();
      else delete data.checkOutAt;
    }
    createRequest.mutate(data);
  }

  return (
    <div>
      <header className="mb-7">
        <p className="text-sm font-medium text-brand">People operations</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{kind ? `${labels[kind]} requests` : "Workflow requests"}</h1>
        <p className="mt-2 text-sm text-muted">
          {isEmployee ? "Submit requests and follow their review status." : `${pendingCount} pending request${pendingCount === 1 ? "" : "s"} awaiting review.`}
        </p>
      </header>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input aria-label="Search requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request or employee..." className="field w-full sm:w-72" />
        <select aria-label="Filter requests by status" value={status} onChange={(event) => setStatus(event.target.value)} className="field w-auto">
          <option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option>
        </select>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {isEmployee && kind && (
        <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-7">
          <h2 className="mb-5 font-semibold">Submit {labels[kind].toLowerCase()} request</h2>
          <form id="request-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            {kind === "LEAVE" && <>
              <label className="text-sm font-medium">Leave type<select name="leaveType" required className={`${inputClass} mt-2`}><option value="">Select type</option>{["CASUAL", "SICK", "EARNED", "MATERNITY", "PATERNITY", "LOSS_OF_PAY"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
              <label className="text-sm font-medium">Start date<input name="startDate" type="date" required className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-medium">End date<input name="endDate" type="date" required className={`${inputClass} mt-2`} /></label>
            </>}
            {kind === "PERMISSION" && <>
              <label className="text-sm font-medium">Date<input name="date" type="date" required className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-medium">Permission type<select name="permissionType" required className={`${inputClass} mt-2`}><option value="">Select type</option><option value="LATE_ARRIVAL">Late arrival</option><option value="EARLY_EXIT">Early exit</option><option value="PERSONAL_WORK">Personal work</option><option value="MEDICAL">Medical purpose</option></select></label>
              <label className="text-sm font-medium">Start time<input name="startTime" type="time" required className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-medium">End time<input name="endTime" type="time" required className={`${inputClass} mt-2`} /></label>
            </>}
            {kind === "OVERTIME" && <>
              <label className="text-sm font-medium">Date<input name="date" type="date" required className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-medium">Shift<input name="shift" maxLength={100} required placeholder="General shift" className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-medium">Extra hours<input name="extraHours" type="number" min="0.25" max="24" step="0.25" required className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-medium">Task details<input name="taskDetails" minLength={3} maxLength={1000} required className={`${inputClass} mt-2`} /></label>
            </>}
            {kind === "REGULARIZATION" && <>
              <label className="text-sm font-medium">Attendance date<input name="date" type="date" required className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-medium">Correct check-in (optional)<input name="checkInAt" type="datetime-local" className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-medium">Correct check-out (optional)<input name="checkOutAt" type="datetime-local" className={`${inputClass} mt-2`} /></label>
            </>}
            <label className={`text-sm font-medium ${kind === "LEAVE" || kind === "REGULARIZATION" ? "sm:col-span-2" : ""}`}>
              Reason
              <textarea name="reason" required minLength={3} maxLength={1000} rows={3} className={`${inputClass} mt-2 resize-y`} />
            </label>
            {kind === "OVERTIME" && <span />}
            <button disabled={createRequest.isPending} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60 sm:col-span-2">
              {createRequest.isPending ? "Submitting..." : "Submit request"}
            </button>
          </form>
        </section>
      )}

      {!isEmployee && reviewError && <p role="alert" className="mb-4 text-sm text-rose-600">{reviewError}</p>}
      {error ? <p role="alert" className="text-sm text-rose-600">{getErrorMessage(error)}</p> : isLoading ? <p className="text-sm text-muted">Loading requests...</p> : requests.length ? (
        <section className="grid gap-4">
          {requests.map((item) => (
            <article key={item._id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-brand"><ClipboardList size={19} /></span>
                  <div>
                    <h2 className="font-semibold">{labels[item.kind]}{item.employeeId?.name ? ` · ${item.employeeId.name}` : ""}</h2>
                    <p className="mt-1 text-xs text-muted">Submitted {new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : item.status === "REJECTED" ? "bg-rose-50 text-rose-700" : item.status === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.status}</span>
              </div>
              <RequestDetails request={item} />
              {item.status === "REJECTED" && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><strong>Rejection reason:</strong> {item.reviewReason}</p>}
              {item.comments && <p className="mt-2 text-sm text-muted">Reviewer comments: {item.comments}</p>}
              {item.reviewedBy?.email && <p className="mt-2 text-xs text-muted">Reviewed by {item.reviewedBy.email}{item.reviewedAt ? ` on ${new Date(item.reviewedAt).toLocaleString()}` : ""}</p>}
              {isEmployee && item.status === "PENDING" && <button onClick={() => cancelRequest.mutate(item._id)} disabled={cancelRequest.isPending} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-rose-600"><X size={15} />Cancel request</button>}
              {canReview && item.status === "PENDING" && <div className="mt-4 border-t border-slate-100 pt-4">
                <label className="block text-sm font-medium">Rejection reason (required to reject)<textarea value={reviewReason[item._id] ?? ""} onChange={(event) => setReviewReason((current) => ({ ...current, [item._id]: event.target.value }))} maxLength={1000} rows={2} className={`${inputClass} mt-2 resize-y`} /></label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={reviewRequest.isPending} onClick={() => reviewRequest.mutate({ id: item._id, decision: "APPROVED" })} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Check size={15} />Approve</button>
                  <button disabled={reviewRequest.isPending || !(reviewReason[item._id] ?? "").trim()} onClick={() => reviewRequest.mutate({ id: item._id, decision: "REJECTED", reason: reviewReason[item._id] })} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><X size={15} />Reject</button>
                </div>
              </div>}
            </article>
          ))}
        </section>
      ) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><RotateCcw size={24} className="mx-auto text-slate-300" /><p className="mt-3 font-medium">No requests found</p><p className="mt-1 text-sm text-muted">{isEmployee ? "Submitted requests will appear here." : "Requests awaiting review will appear here."}</p></div>}
    </div>
  );
}

function RequestDetails({ request }: { request: WorkRequest }) {
  const data = request.data;
  const details = request.kind === "LEAVE"
    ? [`Type: ${String(data.leaveType).replaceAll("_", " ")}`, `Dates: ${dateOnly(data.startDate)} – ${dateOnly(data.endDate)}`, `Days: ${data.totalDays}`]
    : request.kind === "PERMISSION"
      ? [`Type: ${String(data.permissionType).replaceAll("_", " ")}`, `Date: ${dateOnly(data.date)}`, `Time: ${data.startTime}–${data.endTime}`]
      : request.kind === "OVERTIME"
        ? [`Date: ${dateOnly(data.date)}`, `Shift: ${data.shift}`, `Hours: ${data.extraHours}`, `Task: ${data.taskDetails}`]
        : [`Date: ${dateOnly(data.date)}`, `Check-in: ${data.checkInAt ? new Date(data.checkInAt).toLocaleString() : "Not provided"}`, `Check-out: ${data.checkOutAt ? new Date(data.checkOutAt).toLocaleString() : "Not provided"}`];
  return <div className="mt-4">
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">{details.map((detail) => <span key={detail}>{detail}</span>)}</div>
    <p className="mt-3 text-sm"><strong>Reason:</strong> {data.reason}</p>
  </div>;
}
