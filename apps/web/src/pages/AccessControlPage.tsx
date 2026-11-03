import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, UserPlus, UserRoundX } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { PasswordInput } from "../components/PasswordInput";
import { useToast } from "../components/ToastProvider";
import type { PermissionKey, Role } from "../types";

interface RoleConfig {
  role: Role;
  permissions: PermissionKey[];
  configurable: boolean;
}
interface AdminAccount {
  _id: string;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}
interface AccessData {
  roles: RoleConfig[];
  permissionCatalog: { key: PermissionKey; label: string }[];
}

const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin / HR",
  EMPLOYEE: "Employee"
};

export function AccessControlPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<Role, PermissionKey[]>>({
    SUPER_ADMIN: [], ADMIN: [], EMPLOYEE: []
  });
  const { data: access, isLoading, error } = useQuery({
    queryKey: ["access-control", "roles"],
    queryFn: async () => (await api.get<AccessData>("/access/roles")).data
  });
  const { data: admins = [], isLoading: adminsLoading } = useQuery({
    queryKey: ["access-control", "admins"],
    queryFn: async () => (await api.get<{ admins: AdminAccount[] }>("/access/admins")).data.admins
  });
  useEffect(() => {
    if (!access) return;
    setDraft(Object.fromEntries(access.roles.map(({ role, permissions }) => [role, permissions])) as Record<Role, PermissionKey[]>);
  }, [access]);

  const saveRole = useMutation({
    mutationFn: async ({ role, permissions }: { role: Role; permissions: PermissionKey[] }) =>
      api.patch(`/access/roles/${role}`, { permissions }),
    onSuccess: (_result, variables) => {
      toast.success(`${roleLabels[variables.role]} permissions saved.`);
      void queryClient.invalidateQueries({ queryKey: ["access-control", "roles"] });
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });
  const createAdmin = useMutation({
    mutationFn: async (form: FormData) => api.post("/access/admins", Object.fromEntries(form.entries())),
    onSuccess: () => {
      toast.success("Admin account created. The user must change the temporary password at first sign-in.");
      void queryClient.invalidateQueries({ queryKey: ["access-control", "admins"] });
      (document.getElementById("admin-account-form") as HTMLFormElement | null)?.reset();
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });
  const updateAdminStatus = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/access/admins/${id}/status`, { active }),
    onSuccess: (_result, variables) => {
      toast.success(variables.active ? "Admin account reactivated." : "Admin account deactivated.");
      void queryClient.invalidateQueries({ queryKey: ["access-control", "admins"] });
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });

  function submitAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("password") !== data.get("confirmPassword")) {
      toast.error("Passwords do not match.");
      return;
    }
    createAdmin.mutate(data);
  }

  function togglePermission(role: Role, permission: PermissionKey, enabled: boolean) {
    setDraft((current) => ({
      ...current,
      [role]: enabled
        ? [...new Set([...current[role], permission])]
        : current[role].filter((item) => item !== permission)
    }));
  }

  return (
    <div>
      <header className="mb-7">
        <p className="text-sm font-medium text-brand">System administration</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Roles &amp; permissions</h1>
        <p className="mt-2 text-sm text-muted">Configure capabilities for Admin and Employee accounts and manage Admin access.</p>
      </header>

      {error && <p role="alert" className="text-sm text-rose-600">{getErrorMessage(error)}</p>}
      {isLoading && <p className="text-sm text-muted">Loading access policy...</p>}
      {access && (
        <section className="grid gap-5">
          {access.roles.map((roleConfig) => (
            <article key={roleConfig.role} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-brand"><ShieldCheck size={19} /></span>
                  <div>
                    <h2 className="font-semibold">{roleLabels[roleConfig.role]}</h2>
                    <p className="text-xs text-muted">{roleConfig.configurable ? "Select the actions this role may perform." : "Super Admin always has full system access."}</p>
                  </div>
                </div>
                {roleConfig.configurable && <button disabled={saveRole.isPending} onClick={() => saveRole.mutate({ role: roleConfig.role, permissions: draft[roleConfig.role] })} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">Save permissions</button>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {access.permissionCatalog.map(({ key, label }) => (
                  <label key={key} className={`flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2.5 text-sm ${roleConfig.configurable ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}>
                    <input type="checkbox" checked={(draft[roleConfig.role] ?? roleConfig.permissions).includes(key)} disabled={!roleConfig.configurable || saveRole.isPending} onChange={(event) => togglePermission(roleConfig.role, key, event.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-brand"><UserPlus size={19} /></span>
            <div><h2 className="font-semibold">Create Admin / HR account</h2><p className="text-xs text-muted">A temporary password is required at first login.</p></div>
          </div>
          <form id="admin-account-form" onSubmit={submitAdmin} className="space-y-4">
            <label className="block text-sm font-medium">Work email<input name="email" type="email" required maxLength={254} className="field mt-2 w-full" /></label>
            <label className="block text-sm font-medium">Temporary password<PasswordInput name="password" autoComplete="new-password" required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}" title="Use 8-128 characters with uppercase, lowercase, a number, and a special character." className="field mt-2 w-full pr-11" /></label>
            <label className="block text-sm font-medium">Confirm password<PasswordInput name="confirmPassword" autoComplete="new-password" required minLength={8} className="field mt-2 w-full pr-11" /></label>
            <button disabled={createAdmin.isPending} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><KeyRound size={16} />{createAdmin.isPending ? "Creating..." : "Create Admin"}</button>
          </form>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <h2 className="mb-4 font-semibold">Admin accounts</h2>
          {adminsLoading && <p className="text-sm text-muted">Loading Admin accounts...</p>}
          {!adminsLoading && admins.length === 0 && <p className="text-sm text-muted">No Admin accounts exist yet.</p>}
          {!adminsLoading && admins.length > 0 && (
            <div className="divide-y divide-slate-100">
              {admins.map((admin) => (
                <div key={admin._id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                  <div>
                    <p className="text-sm font-medium">{admin.email}</p>
                    <p className="mt-1 text-xs text-muted">{admin.active ? "Active" : "Deactivated"}{admin.mustChangePassword ? " · temporary password pending" : ""}</p>
                  </div>
                  <button disabled={updateAdminStatus.isPending} onClick={() => updateAdminStatus.mutate({ id: admin._id, active: !admin.active })} className={`inline-flex items-center gap-1 text-xs font-medium ${admin.active ? "text-rose-600" : "text-brand"}`}><UserRoundX size={14} />{admin.active ? "Deactivate" : "Reactivate"}</button>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
