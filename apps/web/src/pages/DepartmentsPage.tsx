import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import type { Department, User } from "../types";
import { useToast } from "../components/ToastProvider";
import { CsvImportPanel } from "../components/CsvImportPanel";
import { DateRangeFilter, type DateRangeParams } from "../components/DateRangeFilter";
import { downloadCsv } from "../lib/downloadCsv";

export function DepartmentsPage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Department | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeParams>({ preset: "1y" });
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const filterParams = { ...dateRange, active: String(!showInactive), search };
  const { data, isLoading, error } = useQuery({
    queryKey: ["departments", filterParams],
    queryFn: async () => (await api.get<{ departments: Department[] }>("/departments", { params: filterParams })).data.departments
  });
  const save = useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: FormData }) => {
      const values = Object.fromEntries(form.entries());
      return id ? api.patch(`/departments/${id}`, values) : api.post("/departments", values);
    },
    onSuccess: () => {
      toast.success(editing ? "Department updated." : "Department created.");
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
      (document.getElementById("department-form") as HTMLFormElement | null)?.reset();
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });
  const changeStatus = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/departments/${id}`, { active }),
    onSuccess: (_result, variables) => {
      toast.success(variables.active ? "Department restored." : "Department archived.");
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });
  const canManage = user.role === "SUPER_ADMIN" || user.permissions?.includes("DEPARTMENTS_MANAGE") === true;
  const visibleDepartments = (data ?? []).filter((department) =>
    showInactive ? !department.active : department.active
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({ id: editing?._id, form: new FormData(event.currentTarget) });
  }

  return (
    <div>
      <div className="mb-7"><p className="text-sm font-medium text-brand">Organization</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Departments</h1><p className="mt-2 text-sm text-muted">Organize teams and assign people to the right groups.</p></div>
      {isSuperAdmin && <CsvImportPanel kind="departments" endpoint="/departments/import" headers={["name", "description"]} title="Bulk department import" />}
      {canManage && <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6"><div className="mb-4 flex items-center gap-2">{editing ? <Pencil size={18} className="text-brand" /> : <Plus size={18} className="text-brand" />}<h2 className="font-semibold">{editing ? "Edit department" : "Create department"}</h2>{editing && <button type="button" onClick={() => setEditing(null)} aria-label="Cancel editing" className="ml-auto text-slate-400 hover:text-ink"><X size={18} /></button>}</div><form id="department-form" key={editing?._id ?? "new-department"} onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><input name="name" required maxLength={100} placeholder="Department name" defaultValue={editing?.name ?? ""} className="field" /><input name="description" maxLength={500} placeholder="Short description (optional)" defaultValue={editing?.description ?? ""} className="field" /><button disabled={save.isPending} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">{save.isPending ? "Saving..." : editing ? "Save changes" : "Create"}</button></form></section>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments..." className="field pl-9" /></label>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
        <div className="flex items-center gap-3">{isSuperAdmin && <button onClick={() => void downloadCsv("/departments/export", filterParams, "departments.csv").catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Export failed."))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Export CSV</button>}{canManage && <button onClick={() => setShowInactive(!showInactive)} className="text-xs font-medium text-brand hover:text-indigo-700">{showInactive ? "Show active" : "Show archived"}</button>}</div>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-600">{getErrorMessage(error)}</p> : isLoading ? <p className="text-sm text-muted">Loading departments...</p> : visibleDepartments.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleDepartments.map((department) => <article key={department._id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-brand"><Building2 size={19} /></span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${department.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{department.active ? "Active" : "Archived"}</span></div><h2 className="mt-4 font-semibold">{department.name}</h2><p className="mt-1 min-h-10 text-sm leading-5 text-muted">{department.description || "No description provided."}</p>{canManage && <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3">{department.active ? <><button onClick={() => setEditing(department)} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-indigo-700"><Pencil size={13} />Edit</button><button onClick={() => changeStatus.mutate({ id: department._id, active: false })} className="text-xs font-medium text-rose-600 hover:text-rose-700">Archive</button></> : <button onClick={() => changeStatus.mutate({ id: department._id, active: true })} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-indigo-700"><RotateCcw size={13} />Restore</button>}</div>}</article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Building2 size={24} className="mx-auto text-slate-300" /><p className="mt-3 font-medium">{showInactive ? "No archived departments" : "No departments yet"}</p><p className="mt-1 text-sm text-muted">{showInactive ? "Archived departments will appear here." : "Create your first department to organize employees."}</p></div>}
    </div>
  );
}
