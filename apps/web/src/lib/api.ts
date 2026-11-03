import axios, { type InternalAxiosRequestConfig } from "axios";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    _sessionRetry?: boolean;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

let refreshRequest: Promise<void> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;
    const request = error.config as InternalAxiosRequestConfig | undefined;
    if (
      error.response?.status !== 401 ||
      !request ||
      request._sessionRetry ||
      (request.url?.startsWith("/auth/") && request.url !== "/auth/me")
    ) {
      throw error;
    }
    request._sessionRetry = true;
    refreshRequest ??= api.post("/auth/refresh").then(() => undefined).finally(() => {
      refreshRequest = null;
    });
    await refreshRequest;
    return api(request);
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message;
    if (message) return message;
    if (!error.response) {
      return "Cannot reach the WMS API. Keep the development servers running with `npm.cmd run dev`, then retry.";
    }
    if (error.response.status >= 500) {
      return "The WMS API is unavailable. Check the API terminal and MongoDB connection, then retry.";
    }
  }
  return "The request could not be completed.";
}
