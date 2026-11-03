export const GENERAL_SHIFT = {
  startMinutes: 9 * 60,
  endMinutes: 18 * 60
} as const;

export interface AttendanceMetrics {
  workingMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
}

export function calculateAttendanceMetrics(
  checkInAt: Date,
  checkOutAt: Date,
  shift = GENERAL_SHIFT
): AttendanceMetrics {
  const duration = checkOutAt.getTime() - checkInAt.getTime();
  if (duration < 0) throw new RangeError("Check-out must be after check-in.");

  const checkInMinutes = checkInAt.getUTCHours() * 60 + checkInAt.getUTCMinutes();
  const checkOutMinutes = checkOutAt.getUTCHours() * 60 + checkOutAt.getUTCMinutes();

  return {
    workingMinutes: Math.floor(duration / 60_000),
    lateMinutes: Math.max(0, checkInMinutes - shift.startMinutes),
    earlyLeaveMinutes: Math.max(0, shift.endMinutes - checkOutMinutes),
    overtimeMinutes: Math.max(0, checkOutMinutes - shift.endMinutes)
  };
}
