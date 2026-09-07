import type { HolidayItem } from "../types";
import { addDays, formatVNDate, parseDateInput, weekdayFromDate, weekdayLabel } from "./date";

const tetNguyenDan: Record<number, string> = {
  2024: "2024-02-10",
  2025: "2025-01-29",
  2026: "2026-02-17",
  2027: "2027-02-06",
  2028: "2028-01-26",
  2029: "2029-02-13",
  2030: "2030-02-03",
};

const gioToHungVuong: Record<number, string> = {
  2024: "2024-04-18",
  2025: "2025-04-07",
  2026: "2026-04-26",
  2027: "2027-04-15",
  2028: "2028-04-04",
  2029: "2029-04-23",
  2030: "2030-04-12",
};

export function loadVietnamHolidays(year: number): HolidayItem[] {
  const holidays: HolidayItem[] = [];
  const pushHoliday = (date: string, name: string) => {
    if (date) holidays.push({ date, name });
  };

  pushHoliday(`${year}-01-01`, "Tết Dương lịch");
  pushHoliday(gioToHungVuong[year] ?? "", "Giỗ Tổ Hùng Vương");
  pushHoliday(`${year}-04-30`, "30/4");
  pushHoliday(`${year}-05-01`, "1/5");
  pushHoliday(`${year}-09-02`, "2/9");
  pushHoliday(tetNguyenDan[year] ?? "", "Tết Nguyên Đán");

  return holidays;
}

export function normalizeHolidayList(list: HolidayItem[]): HolidayItem[] {
  const seen = new Set<string>();
  return list
    .filter((item) => item.date)
    .filter((item) => {
      if (seen.has(item.date)) return false;
      seen.add(item.date);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function isHoliday(date: string, holidays: HolidayItem[]): boolean {
  return holidays.some((holiday) => holiday.date === date);
}

export function isWorkingDate(date: Date, workdays: number[], holidays: HolidayItem[]): boolean {
  const key = formatVNDate(date).split("/").reverse().join("-");
  return workdays.includes(weekdayFromDate(date)) && !isHoliday(key, holidays);
}

export function buildMonthGrid(monthAnchor: string, selectedDay: string, holidays: HolidayItem[], workdays: number[]) {
  const selected = parseDateInput(monthAnchor);
  const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const offset = (start.getDay() + 6) % 7;
  const cells: Array<{ date: string; label: string; state: "empty" | "normal" | "holiday" | "weekend" | "start" }> = [];

  for (let i = 0; i < offset; i += 1) {
    cells.push({ date: "", label: "", state: "empty" });
  }

  for (let day = 1; day <= end.getDate(); day += 1) {
    const current = new Date(selected.getFullYear(), selected.getMonth(), day);
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const state = !workdays.includes(current.getDay())
      ? "weekend"
      : isHoliday(key, holidays)
        ? "holiday"
        : "normal";
    cells.push({
      date: key,
      label: String(day),
      state: key === selectedDay ? "start" : state,
    });
  }

  return {
    monthTitle: `${selected.getMonth() + 1}/${selected.getFullYear()}`,
    weekdayLabels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    cells,
  };
}

export function nextWorkingDate(current: Date, workdays: number[], holidays: HolidayItem[]): Date {
  let next = addDays(current, 1);
  while (!isWorkingDate(next, workdays, holidays)) {
    next = addDays(next, 1);
  }
  return next;
}
