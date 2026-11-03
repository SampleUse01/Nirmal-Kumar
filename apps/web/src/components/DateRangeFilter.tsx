import { useState } from "react";

export type DateRangeParams =
  | { preset: "today" | "7d" | "1m" | "1y" }
  | { preset: "custom"; from?: string; to?: string };

export function DateRangeFilter({
  value,
  onChange
}: {
  value: DateRangeParams;
  onChange: (range: DateRangeParams) => void;
}) {
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter by date range"
        value={value.preset}
        onChange={(event) => {
          const preset = event.target.value as DateRangeParams["preset"];
          onChange(preset === "custom" ? { preset, from, to } : { preset });
        }}
        className="field w-auto min-w-36"
      >
        <option value="today">Today</option>
        <option value="7d">Last 7 days</option>
        <option value="1m">Last 1 month</option>
        <option value="1y">Last 1 year</option>
        <option value="custom">Custom range</option>
      </select>
      {value.preset === "custom" && <>
        <input aria-label="Start date" type="date" value={from} onChange={(event) => {
          setFrom(event.target.value);
          onChange({ preset: "custom", from: event.target.value, to });
        }} className="field w-auto" />
        <input aria-label="End date" type="date" value={to} onChange={(event) => {
          setTo(event.target.value);
          onChange({ preset: "custom", from, to: event.target.value });
        }} className="field w-auto" />
      </>}
    </div>
  );
}
