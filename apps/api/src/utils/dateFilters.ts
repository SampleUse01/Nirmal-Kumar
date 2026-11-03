import { HttpError } from "./errors.js";

export type DatePreset = "today" | "7d" | "1m" | "1y" | "custom";

export function getDateRange(
  query: Record<string, unknown>,
  now = new Date()
): { $gte?: Date; $lt?: Date } | null {
  const presetValue = query.preset;
  const fromValue = query.from;
  const toValue = query.to;
  const preset = typeof presetValue === "string" ? presetValue : undefined;

  if (preset === "today") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { $gte: start, $lt: end };
  }
  if (preset === "7d" || preset === "1m" || preset === "1y") {
    const start = new Date(now);
    if (preset === "7d") {
      start.setUTCDate(start.getUTCDate() - 6);
    } else {
      const day = start.getUTCDate();
      start.setUTCDate(1);
      if (preset === "1m") start.setUTCMonth(start.getUTCMonth() - 1);
      else start.setUTCFullYear(start.getUTCFullYear() - 1);
      const finalDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
      start.setUTCDate(Math.min(day, finalDay));
    }
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() + 1);
    return { $gte: start, $lt: end };
  }
  if (preset && preset !== "custom") {
    throw new HttpError(400, "Date preset must be today, 7d, 1m, 1y, or custom.");
  }

  const range: { $gte?: Date; $lt?: Date } = {};
  if (typeof fromValue === "string" && fromValue) {
    const from = new Date(fromValue);
    if (Number.isNaN(from.getTime())) throw new HttpError(400, "The start date is invalid.");
    from.setUTCHours(0, 0, 0, 0);
    range.$gte = from;
  }
  if (typeof toValue === "string" && toValue) {
    const to = new Date(toValue);
    if (Number.isNaN(to.getTime())) throw new HttpError(400, "The end date is invalid.");
    to.setUTCHours(0, 0, 0, 0);
    to.setUTCDate(to.getUTCDate() + 1);
    range.$lt = to;
  }
  if (range.$gte && range.$lt && range.$gte >= range.$lt) {
    throw new HttpError(400, "The start date must be on or before the end date.");
  }
  return Object.keys(range).length ? range : null;
}

export function csvCell(value: unknown): string {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
