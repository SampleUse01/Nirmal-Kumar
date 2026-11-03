import assert from "node:assert/strict";
import test from "node:test";
import { getDateRange, toCsv } from "./dateFilters.js";

test("date presets return UTC day bounds including today", () => {
  const range = getDateRange({ preset: "today" }, new Date("2025-03-15T12:30:00.000Z"));
  assert.equal(range?.$gte?.toISOString(), "2025-03-15T00:00:00.000Z");
  assert.equal(range?.$lt?.toISOString(), "2025-03-16T00:00:00.000Z");
});

test("custom date filters include the whole end date", () => {
  const range = getDateRange({ from: "2025-03-01", to: "2025-03-03" });
  assert.equal(range?.$gte?.toISOString(), "2025-03-01T00:00:00.000Z");
  assert.equal(range?.$lt?.toISOString(), "2025-03-04T00:00:00.000Z");
});

test("one-month range clamps to the last valid day of the previous month", () => {
  const range = getDateRange({ preset: "1m" }, new Date("2025-03-31T12:30:00.000Z"));
  assert.equal(range?.$gte?.toISOString(), "2025-02-28T00:00:00.000Z");
});

test("CSV output escapes quotes and neutralizes spreadsheet formulas", () => {
  assert.match(toCsv(["value"], [['=1+1,"quoted"']]), /"'=1\+1,""quoted"""/);
});
