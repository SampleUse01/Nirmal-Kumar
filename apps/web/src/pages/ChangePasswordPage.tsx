import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../lib/api";
import type { User } from "../types";
import { ThemeToggle } from "../components/ThemeToggle";
import { PasswordInput } from "../components/PasswordInput";
import { useToast } from "../components/ToastProvider";

export function ChangePasswordPage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      const error = "New password and confirmation do not match.";
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post<{ user: User }>("/auth/change-password", {
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
        confirmPassword: form.get("confirmPassword")
      });
      queryClient.setQueryData(["session"], data.user);
      toast.success("Password changed successfully.");
      navigate("/", { replace: true });
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-card sm:p-9">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-brand"><KeyRound size={21} /></div>
        <p className="mt-6 text-sm font-medium text-brand">Secure your account</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Your administrator created a temporary password for {user.email}. Choose a new one to continue.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">Temporary password<PasswordInput required autoComplete="current-password" name="currentPassword" className="field mt-2 w-full pr-11" /></label>
          <label className="block text-sm font-medium">New password<PasswordInput required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}" title="Use 8-128 characters with uppercase, lowercase, a number, and a special character." autoComplete="new-password" name="newPassword" className="field mt-2 w-full pr-11" /><span className="mt-1 block text-xs font-normal text-muted">Use 8+ characters with uppercase, lowercase, a number, and a special character.</span></label>
          <label className="block text-sm font-medium">Confirm new password<PasswordInput required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}" title="Use 8-128 characters with uppercase, lowercase, a number, and a special character." autoComplete="new-password" name="confirmPassword" className="field mt-2 w-full pr-11" /></label>
          <button disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">{busy ? "Updating..." : "Update password"}</button>
        </form>
      </section>
    </main>
  );
}
