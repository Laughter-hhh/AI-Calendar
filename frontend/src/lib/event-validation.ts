export const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventValidationError";
  }
}

export function eventTimingError(startTime: string | null, endTime: string | null): string | null {
  if (startTime !== null && !TIME_PATTERN.test(startTime)) {
    return "开始时间格式不正确，请使用 HH:mm";
  }
  if (endTime !== null && !TIME_PATTERN.test(endTime)) {
    return "结束时间格式不正确，请使用 HH:mm";
  }
  if (endTime !== null && startTime === null) {
    return "设置结束时间前请先设置开始时间";
  }
  if (startTime !== null && endTime !== null && endTime <= startTime) {
    return "结束时间必须晚于开始时间";
  }
  return null;
}

export function assertValidEventTiming(startTime: string | null, endTime: string | null): void {
  const error = eventTimingError(startTime, endTime);
  if (error) throw new EventValidationError(error);
}
