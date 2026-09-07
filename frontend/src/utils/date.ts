const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string): Date {
  if (!value) return new Date();
  return new Date(`${value}T00:00:00`);
}

export function formatVNDate(value: string | Date): string {
  const date = typeof value === "string" ? parseDateInput(value) : value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function weekdayFromDate(value: string | Date): number {
  const date = typeof value === "string" ? parseDateInput(value) : value;
  return date.getDay();
}

export function weekdayLabel(index: number): string {
  return weekdayLabels[index] ?? "";
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
