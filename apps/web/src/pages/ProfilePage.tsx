import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { PasswordInput } from "../components/PasswordInput";
import { api, getErrorMessage } from "../lib/api";
import type { User } from "../types";
import { useToast } from "../components/ToastProvider";

interface Profile {
  id: string;
  email: string;
  role: User["role"];
  employee: {
    employeeId: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    designation: string;
    departmentId?: { _id: string; name: string } | null;
    joiningDate?: string | null;
  } | null;
}

export function ProfilePage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await api.get<{ profile: Profile }>("/auth/profile")).data.profile
  });

  const updateProfile = useMutation({
    mutationFn: async (form: FormData) =>
      (await api.patch<{ profile: Profile }>("/auth/profile", Object.fromEntries(form.entries()))).data.profile,
    onSuccess: (profile) => {
      toast.success("Your profile has been updated.");
      queryClient.setQueryData<User>(["session"], (session) =>
        session
          ? {
              ...session,
              email: profile.email,
              employee: profile.employee
                ? { employeeId: profile.employee.employeeId, name: profile.employee.name }
                : null
            }
          : session
      );
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });

  const changePassword = useMutation({
    mutationFn: async ({ formData }: { formData: FormData; formElement: HTMLFormElement }) =>
      api.post<{ user: User }>("/auth/change-password", {
        currentPassword: formData.get("currentPassword"),
        newPassword: formData.get("newPassword"),
        confirmPassword: formData.get("confirmPassword")
      }),
    onSuccess: ({ data: result }, variables) => {
      toast.success("Your password has been changed.");
      queryClient.setQueryData(["session"], result.user);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      variables.formElement.reset();
    },
    onError: (requestError) => toast.error(getErrorMessage(requestError))
  });

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile.mutate(new FormData(event.currentTarget));
  }

  function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    if (formData.get("newPassword") !== formData.get("confirmPassword")) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    changePassword.mutate({ formData, formElement });
  }

  return (
    <div>
      <header className="mb-7">
        <p className="text-sm font-medium text-brand">Account settings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">My profile</h1>
        <p className="mt-2 text-sm text-muted">Update your account details and password.</p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted">Loading profile...</p>
      ) : error ? (
        <p role="alert" className="text-sm text-rose-600">{getErrorMessage(error)}</p>
      ) : data ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-brand"><UserRound size={19} /></span>
              <div><h2 className="font-semibold">Personal information</h2><p className="text-xs text-muted">{user.role.replaceAll("_", " ")}</p></div>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <label className="block text-sm font-medium">
                Account email
                <input name="email" type="email" required maxLength={254} defaultValue={data.email} className="field mt-2 w-full" />
              </label>
              {data.employee && (
                <>
                  <label className="block text-sm font-medium">
                    Full name
                    <input name="name" required maxLength={120} defaultValue={data.employee.name} className="field mt-2 w-full" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium">
                      Employee ID
                      <input readOnly value={data.employee.employeeId} className="field mt-2 w-full opacity-70" />
                    </label>
                    <label className="block text-sm font-medium">
                      Designation
                      <input readOnly value={data.employee.designation || "—"} className="field mt-2 w-full opacity-70" />
                    </label>
                  </div>
                  <label className="block text-sm font-medium">
                    Phone
                    <input name="phone" type="tel" maxLength={30} defaultValue={data.employee.phone} className="field mt-2 w-full" />
                  </label>
                  <label className="block text-sm font-medium">
                    Address
                    <textarea name="address" rows={3} maxLength={500} defaultValue={data.employee.address} className="field mt-2 w-full resize-y" />
                  </label>
                </>
              )}
              <button disabled={updateProfile.isPending} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60">
                {updateProfile.isPending ? "Saving..." : "Save profile"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-brand"><KeyRound size={19} /></span>
              <div><h2 className="font-semibold">Change password</h2><p className="text-xs text-muted">Use a strong password you have not used before.</p></div>
            </div>
            <form onSubmit={savePassword} className="space-y-4">
              <label className="block text-sm font-medium">
                Current password
                <PasswordInput name="currentPassword" required autoComplete="current-password" className="field mt-2 w-full pr-11" />
              </label>
              <label className="block text-sm font-medium">
                New password
                <PasswordInput name="newPassword" required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}" title="Use 8-128 characters with uppercase, lowercase, a number, and a special character." autoComplete="new-password" className="field mt-2 w-full pr-11" />
                <span className="mt-1 block text-xs font-normal text-muted">At least 8 characters with uppercase, lowercase, a number, and a special character.</span>
              </label>
              <label className="block text-sm font-medium">
                Confirm new password
                <PasswordInput name="confirmPassword" required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}" title="Use 8-128 characters with uppercase, lowercase, a number, and a special character." autoComplete="new-password" className="field mt-2 w-full pr-11" />
              </label>
              <button disabled={changePassword.isPending} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                {changePassword.isPending ? "Updating..." : "Update password"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
