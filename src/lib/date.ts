// Date helpers shared by signup, checkout and quota rollover.
// JS setMonth() overflows (Jan 31 + 1 month = Mar 3) which silently grants
// extra free days / misstates invoice periods. Always clamp to end of month.

export function addMonthsClamped(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  const targetMonth = result.getMonth() + months;
  const targetYear = result.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const day = result.getDate();
  // Day 0 of the next month = last day of the target month
  const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  result.setFullYear(targetYear, normalizedMonth, Math.min(day, daysInTargetMonth));
  return result;
}

export function addMonthsClampedFromNow(months: number, now = new Date()): Date {
  return addMonthsClamped(now, months);
}
