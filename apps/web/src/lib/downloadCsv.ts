import { api, getErrorMessage } from "./api";

export async function downloadCsv(path: string, params: Record<string, string>, filename: string) {
  try {
    const response = await api.get<Blob>(path, { params, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
