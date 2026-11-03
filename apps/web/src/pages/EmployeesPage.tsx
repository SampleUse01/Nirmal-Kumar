import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Search, UserPlus, X } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import type { Department, Employee, User } from "../types";
import { PasswordInput } from "../components/PasswordInput";
import { useToast } from "../components/ToastProvider";
import { CsvImportPanel } from "../components/CsvImportPanel";
import { DateRangeFilter, type DateRangeParams } from "../components/DateRangeFilter";
import { downloadCsv } from "../lib/downloadCsv";

export function EmployeesPage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeParams>({ preset: "1y" });
  const canManage = user.role === "SUPER_ADMIN" || user.permissions?.includes("EMPLOYEES_MANAGE") === true;
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const filterParams = {
    ...dateRange,
    ...(status === "all" ? {} : { active: String(status === "active") }),
    ...(departmentId ? { departmentId } : {}),
    search
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ["employees", "list", filterParams, page],
    queryFn: async () => (await api.get<{ employees: Employee[]; pagination: { total: number; page: number; pages: number; limit: number } }>("/employees", { params: { ...filterParams, page, limit: 20 } })).data
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get<{ departments: Department[] }>("/departments")).data.departments
  });
  const saveEmployee = useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: FormData }) => {
      const values = Object.fromEntries(form.entries());
      return id ? api.patch(`/employees/${id}`, values) : api.post("/employees", values);
    },
    onSuccess: () => {
      toast.success(editing ? "Employee updated successfully." : "Employee added successfully.");
      setEditing(null);
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      (document.getElementById("employee-form") as HTMLFormElement | null)?.reset();
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });
  const changeStatus = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/employees/${id}`, { active }),
    onSuccess: (_result, variables) => {
      toast.success(variables.active ? "Employee restored." : "Employee deactivated.");
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });

  useEffect(() => {
    setPage(1);
  }, [search, departmentId, status, dateRange]);

  useEffect(() => {
    if (!showForm) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saveEmployee.isPending) {
        setShowForm(false);
        setEditing(null);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showForm, saveEmployee.isPending]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      !editing &&
      form.get("initialPassword") !== form.get("confirmInitialPassword")
    ) {
      const error = "Temporary password and confirmation do not match.";
      toast.error(error);
      return;
    }
    saveEmployee.mutate({ id: editing?._id, form });
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-brand">People directory</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Employees</h1><p className="mt-2 text-sm text-muted">Manage employee records and their departments.</p></div>
        <div className="flex flex-wrap items-center gap-3">
          {canManage && <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600"><Plus size={17} />Add employee</button>}
        </div>
      </div>
      {isSuperAdmin && <CsvImportPanel kind="employees" endpoint="/employees/import" headers={["employeeId", "name", "email", "phone", "department", "designation", "joiningDate", "initialPassword"]} sensitiveHeaders={["initialPassword"]} title="Bulk employee import" />}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Directory</h2><div className="flex items-center gap-3">{isSuperAdmin && <button onClick={() => void downloadCsv("/employees/export", filterParams, "employees.csv").catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Export failed."))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">Export CSV</button>}<span className="text-xs text-muted">{data?.pagination.total ?? 0} employees</span></div></div>
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or ID..." aria-label="Search employees" className="field pl-9" /></label>
          <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} aria-label="Filter by department" className="field"><option value="">All departments</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}{department.active ? "" : " (Archived)"}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filter by employee status" className="field"><option value="active">Active employees</option><option value="inactive">Inactive employees</option><option value="all">All statuses</option></select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
        {isLoading ? <p className="p-8 text-center text-sm text-muted">Loading employees...</p> : error ? <p role="alert" className="p-8 text-center text-sm text-rose-600">{getErrorMessage(error)}</p> : data?.employees.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Employee ID</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Designation</th><th className="px-5 py-3">Status</th>{canManage && <th className="px-5 py-3">Actions</th>}</tr></thead><tbody className="divide-y divide-slate-100">{data.employees.map((employee) => <tr key={employee._id}><td className="px-5 py-4"><p className="font-medium">{employee.name}</p><p className="mt-0.5 text-xs text-muted">{employee.email}</p></td><td className="px-5 py-4 text-slate-600">{employee.employeeId}</td><td className="px-5 py-4 text-slate-600">{employee.departmentId?.name ?? "—"}</td><td className="px-5 py-4 text-slate-600">{employee.designation || "—"}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${employee.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{employee.active ? "Active" : "Inactive"}</span></td>{canManage && <td className="px-5 py-4"><div className="flex gap-3">{employee.active && <><button onClick={() => { setEditing(employee); setShowForm(true); }} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-indigo-700"><Pencil size={13} />Edit</button><button onClick={() => changeStatus.mutate({ id: employee._id, active: false })} className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"><Archive size={13} />Deactivate</button></>}{!employee.active && <button onClick={() => changeStatus.mutate({ id: employee._id, active: true })} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-indigo-700"><RotateCcw size={13} />Restore</button>}</div></td>}</tr>)}</tbody></table></div>
        ) : <p className="p-10 text-center text-sm text-muted">No employees match the selected filters.</p>}
        {data?.pagination.pages && data.pagination.pages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3"><p className="text-xs text-muted">Page {data.pagination.page} of {data.pagination.pages}</p><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:opacity-50"><ChevronLeft size={14} />Previous</button><button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((current) => Math.min(data.pagination.pages, current + 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">Next<ChevronRight size={14} /></button></div></div>}
      </section>
      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !saveEmployee.isPending) { setShowForm(false); setEditing(null); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-brand"><UserPlus size={19} /></span><div><h2 id="employee-dialog-title" className="text-lg font-semibold">{editing ? "Edit employee" : "Add employee"}</h2><p className="mt-1 text-sm text-muted">{editing ? "Update employee profile details." : "Create an employee profile and login account."}</p></div></div><button type="button" disabled={saveEmployee.isPending} onClick={() => { setShowForm(false); setEditing(null); }} aria-label="Close employee form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink disabled:opacity-50"><X size={18} /></button></div>
          <form id="employee-form" key={editing?._id ?? "new-employee"} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Employee ID<input name="employeeId" required placeholder="Employee ID" defaultValue={editing?.employeeId ?? ""} className="field mt-1.5 w-full" /></label>
            <label className="text-sm font-medium">Full name<input name="name" required placeholder="Full name" defaultValue={editing?.name ?? ""} className="field mt-1.5 w-full" /></label>
            <label className="text-sm font-medium">Work email<input name="email" type="email" required placeholder="Work email" defaultValue={editing?.email ?? ""} className="field mt-1.5 w-full" /></label>
            <label className="text-sm font-medium">Phone<input name="phone" placeholder="Phone (optional)" defaultValue={editing?.phone ?? ""} className="field mt-1.5 w-full" /></label>
            {!editing && <label className="text-sm font-medium">Temporary password<PasswordInput name="initialPassword" autoComplete="new-password" required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,128}" title="Use 8-128 characters with uppercase, lowercase, a number, and a special character." placeholder="Temporary password" className="field mt-1.5 w-full pr-11" /></label>}
            {!editing && <label className="text-sm font-medium">Confirm temporary password<PasswordInput name="confirmInitialPassword" autoComplete="new-password" required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,128}" title="Use 8-128 characters with uppercase, lowercase, a number, and a special character." placeholder="Confirm password" className="field mt-1.5 w-full pr-11" /></label>}
            <label className="text-sm font-medium">Designation<input name="designation" placeholder="Designation" defaultValue={editing?.designation ?? ""} className="field mt-1.5 w-full" /></label>
            <label className="text-sm font-medium">Department<select name="departmentId" defaultValue={editing?.departmentId?._id ?? ""} className="field mt-1.5 w-full"><option value="">No department</option>{departments.filter((department) => department.active).map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" disabled={saveEmployee.isPending} onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancel</button><button disabled={saveEmployee.isPending} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60">{saveEmployee.isPending ? "Saving..." : editing ? "Save changes" : "Add employee"}</button></div>
          </form>
          {!editing && <p className="mt-4 text-xs text-muted">Temporary password must include uppercase and lowercase letters, a number, and a special character. The employee must change it at first sign-in.</p>}
        </section>
      </div>}
    </div>
  );
}
