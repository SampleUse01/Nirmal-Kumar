import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "../lib/api";
import { useToast } from "./ToastProvider";

type ImportResult = {
  row: number;
  status: "imported" | "failed";
  name?: string;
  employeeId?: string;
  email?: string;
  errors: string[];
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && !cell) quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function CsvImportPanel({
  kind,
  endpoint,
  headers,
  title,
  sensitiveHeaders = []
}: {
  kind: string;
  endpoint: string;
  headers: string[];
  title: string;
  sensitiveHeaders?: string[];
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [parseError, setParseError] = useState("");
  const importRows = useMutation({
    mutationFn: async () => (await api.post<{ results: ImportResult[]; imported: number; failed: number }>(endpoint, { rows })).data,
    onSuccess: (result) => {
      setResults(result.results);
      const message = `${result.imported} imported, ${result.failed} failed.`;
      if (result.failed === 0) toast.success(message);
      else if (result.imported === 0) toast.error(message);
      else toast.info(message);
      void queryClient.invalidateQueries({ queryKey: [kind] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  async function loadFile(file?: File) {
    setParseError("");
    setResults(null);
    setRows([]);
    if (!file) return;
    if (file.size > 2_000_000) {
      setParseError("CSV files must be 2 MB or smaller.");
      return;
    }
    try {
      const parsed = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
      if (!parsed.length) throw new Error("The CSV file is empty.");
      const fileHeaders = parsed[0].map((header) => header.trim());
      if (new Set(fileHeaders).size !== fileHeaders.length) throw new Error("The CSV contains duplicate column names.");
      const missing = headers.filter((header) => !fileHeaders.includes(header));
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);
      const records = parsed.slice(1).map((cells) =>
        Object.fromEntries(headers.map((header) => [header, cells[fileHeaders.indexOf(header)]?.trim() ?? ""]))
      );
      if (!records.length) throw new Error("The CSV has headers but no data rows.");
      if (records.length > 1000) throw new Error("A maximum of 1,000 rows can be imported at once.");
      setRows(records);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Could not read the CSV file.");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`${headers.map((value) => `"${value}"`).join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${kind}-template.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const resultRows = results ?? rows.map((row, index) => ({
    row: index + 2,
    status: "failed" as const,
    name: row.name || row.employeeId || row.email || "—",
    email: row.email,
    employeeId: row.employeeId,
    errors: []
  }));
  return (
    <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-muted">Download the template, fill the rows, preview them, then confirm the import.</p></div>
        <button type="button" onClick={downloadTemplate} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">Download CSV template</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input aria-label={`${kind} CSV file`} type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} className="block max-w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand" />
        {rows.length > 0 && <button type="button" onClick={() => importRows.mutate()} disabled={importRows.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{importRows.isPending ? "Importing..." : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}</button>}
      </div>
      {kind === "employees" && <p className="mt-3 text-xs text-amber-700">Each employee needs a unique strong initialPassword in the CSV; the account will require a password change at first sign-in. Passwords are masked in the preview and excluded from exports. A department name that does not exist will be created during the confirmed import; archived departments must be restored first.</p>}
      {parseError && <p role="alert" className="mt-3 text-sm text-rose-600">{parseError}</p>}
      {resultRows.length > 0 && <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[700px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-muted"><tr><th className="px-3 py-2">CSV row</th>{headers.filter((header) => !sensitiveHeaders.includes(header)).map((header) => <th key={header} className="px-3 py-2">{header}</th>)}<th className="px-3 py-2">Status</th><th className="px-3 py-2">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{resultRows.map((result) => {
        const row = rows[result.row - 2];
        const status = results ? result.status : "Ready to import";
        return <tr key={result.row}><td className="px-3 py-2">{result.row}</td>{headers.filter((header) => !sensitiveHeaders.includes(header)).map((header) => <td key={header} className="px-3 py-2">{row?.[header] || "—"}</td>)}<td className={`px-3 py-2 font-medium ${result.status === "imported" ? "text-emerald-700" : results ? "text-rose-600" : "text-slate-600"}`}>{status}</td><td className="px-3 py-2">{result.errors.join(" ") || (results ? "Imported successfully." : "Ready for server validation.")}</td></tr>;
      })}</tbody></table></div>}
    </section>
  );
}
