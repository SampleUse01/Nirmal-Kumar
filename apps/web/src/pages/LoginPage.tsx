import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LockKeyhole, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../lib/api";
import type { User } from "../types";
import { ThemeToggle } from "../components/ThemeToggle";
import { useTheme } from "../components/ThemeProvider";
import { PasswordInput } from "../components/PasswordInput";
import { useToast } from "../components/ToastProvider";

export function LoginPage() {
  const { theme } = useTheme();
  const toast = useToast();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: async () => (await api.get<{ status: string; database: string }>("/health")).data,
    retry: false,
    refetchInterval: 15_000
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/login", { email, password });
      const { data } = await api.get<{ user: User }>("/auth/me");
      queryClient.setQueryData(["session"], data.user);
      toast.success("Signed in successfully.");
      navigate("/", { replace: true });
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      data-theme={theme}
      className={`login-page relative grid min-h-screen overflow-hidden px-5 py-12 md:grid-cols-2 md:px-12 ${
        isDark ? "bg-[#10152e] text-white" : "bg-canvas text-ink"
      }`}
    >
      <div className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-indigo-500/30 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-36 right-0 h-[30rem] w-[30rem] rounded-full bg-violet-500/20 blur-[120px]" />
      <div className="absolute right-5 top-5 z-10 md:right-8 md:top-8">
        <ThemeToggle />
      </div>
      <div className="relative hidden flex-col justify-between py-8 md:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-xl font-bold ring-1 ring-white/15">W</div>
          <span className="font-semibold tracking-wide">WORKFORCE</span>
        </div>
        <div className="max-w-lg">
          <p className={`mb-5 text-xs font-semibold uppercase tracking-[.24em] ${isDark ? "text-indigo-300" : "text-brand"}`}>People. In sync.</p>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight">A clearer view of your most important work.</h1>
          <p className={`mt-6 max-w-md text-base leading-7 ${isDark ? "text-slate-300" : "text-slate-600"}`}>Bring your people, attendance, and everyday operations into one thoughtfully designed workspace.</p>
        </div>
        <p className="text-xs text-slate-500">Enterprise workforce management</p>
      </div>
      <div className="relative flex items-center justify-center md:justify-end">
        <motion.section
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
          className={`w-full max-w-[420px] rounded-[28px] border p-7 backdrop-blur-2xl sm:p-10 ${
            isDark
              ? "border-white/15 bg-white/[.08] shadow-2xl shadow-black/20"
              : "border-slate-200 bg-white/90 shadow-card"
          }`}
        >
          <div className={`mb-8 grid h-12 w-12 place-items-center rounded-2xl ${isDark ? "bg-indigo-400/15 text-indigo-200" : "bg-indigo-50 text-brand"}`}><UsersRound size={23} /></div>
          <p className={`text-sm font-medium ${isDark ? "text-indigo-200" : "text-brand"}`}>Welcome back</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm text-slate-300">Enter your work account details below.</p>
          {health.isError && (
            <p role="status" className={`mt-5 rounded-lg border px-3 py-2 text-sm leading-5 ${isDark ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {getErrorMessage(health.error)}
            </p>
          )}
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className={`block text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Work email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300/20 ${
                  isDark
                    ? "border-white/15 bg-white/[.07] text-white placeholder:text-slate-500 focus:border-indigo-300"
                    : "border-slate-200 bg-white text-ink placeholder:text-slate-400 focus:border-brand"
                }`}
                placeholder="you@company.com"
              />
            </label>
            <label className={`block text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Password
              <span className="relative mt-2 block">
                <PasswordInput
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-indigo-300/20 ${
                    isDark
                      ? "border-white/15 bg-white/[.07] text-white placeholder:text-slate-500 focus:border-indigo-300"
                      : "border-slate-200 bg-white text-ink placeholder:text-slate-400 focus:border-brand"
                  }`}
                  placeholder="Enter your password"
                />
              </span>
            </label>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-70">
              <LockKeyhole size={16} />{busy ? "Signing in..." : "Sign in to workspace"}
            </button>
          </form>
          <p className="mt-7 text-center text-xs leading-5 text-slate-400">Your session is protected with secure, HttpOnly cookies.</p>
        </motion.section>
      </div>
    </main>
  );
}
