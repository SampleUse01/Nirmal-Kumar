import assert from "node:assert/strict";
import test from "node:test";
import { calculateAttendanceMetrics } from "./attendance.js";

test("calculates a compliant general-shift workday", () => {
  assert.deepEqual(
    calculateAttendanceMetrics(
      new Date("2026-01-05T09:00:00.000Z"),
      new Date("2026-01-05T18:00:00.000Z")
    ),
    { workingMinutes: 540, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 }
  );
});

test("calculates late arrival, early exit, and overtime independently", () => {
  assert.deepEqual(
    calculateAttendanceMetrics(
      new Date("2026-01-05T09:15:00.000Z"),
      new Date("2026-01-05T19:00:00.000Z")
    ),
    { workingMinutes: 585, lateMinutes: 15, earlyLeaveMinutes: 0, overtimeMinutes: 60 }
  );
  assert.deepEqual(
    calculateAttendanceMetrics(
      new Date("2026-01-05T08:50:00.000Z"),
      new Date("2026-01-05T17:30:00.000Z")
    ),
    { workingMinutes: 520, lateMinutes: 0, earlyLeaveMinutes: 30, overtimeMinutes: 0 }
  );
});

test("rejects a checkout earlier than check-in", () => {
  assert.throws(
    () =>
      calculateAttendanceMetrics(
        new Date("2026-01-05T18:00:00.000Z"),
        new Date("2026-01-05T09:00:00.000Z")
      ),
    RangeError
  );
});
