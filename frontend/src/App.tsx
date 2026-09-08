import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { exportScheduleToExcel, downloadTemplate, parseExcelRecords } from "./utils/excel";
import { buildMonthGrid, loadVietnamHolidays, normalizeHolidayList } from "./utils/calendar";
import { formatVNDate, monthKey, parseDateInput, toDateInputValue, weekdayLabel, weekdayFromDate } from "./utils/date";
import type { AppSettings, HolidayItem, PORecord, PlanRow, ScheduleResult, TeamConfig } from "./types";
import { buildSchedule, summarizeJobs } from "./utils/planning";
import { AppHeader } from "./components/AppHeader";
import { PODataTable } from "./components/PODataTable";
import { ProgressBar } from "./components/ProgressBar";

type TabKey = "config" | "calendar" | "input" | "plan" | "team" | "report";

const STORAGE_KEY = "silk-screen-planner-v1";
const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

function makeDefaultTeams(count: number): TeamConfig[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Tổ ${index + 1}`,
    tables: 120,
  }));
}

function loadInitialState() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const defaultSettings: AppSettings = {
    minutesPerDay: 483,
    dailyMinutes: {},
    startDate: toDateInputValue(start),
    workdays: DEFAULT_WORKDAYS,
    holidays: [],
    teams: makeDefaultTeams(15),
  };

  if (typeof window === "undefined") {
    return {
      settings: defaultSettings,
      rows: [] as PORecord[],
      tab: "config" as TabKey,
      visibleMonth: monthKey(start),
      selectedDay: toDateInputValue(start),
      actuals: {} as Record<string, string>,
      customHolidayDate: toDateInputValue(start),
      customHolidayName: "",
      teamFilter: 1,
    };
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return {
      settings: defaultSettings,
      rows: [] as PORecord[],
      tab: "config" as TabKey,
      visibleMonth: monthKey(start),
      selectedDay: toDateInputValue(start),
      actuals: {} as Record<string, string>,
      customHolidayDate: toDateInputValue(start),
      customHolidayName: "",
      teamFilter: 1,
    };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<{
      settings: AppSettings;
      rows: PORecord[];
      tab: TabKey;
      visibleMonth: string;
      selectedDay: string;
      actuals: Record<string, string>;
      teamFilter: number;
    }>;
    return {
      settings: {
        ...defaultSettings,
        ...parsed.settings,
        dailyMinutes: parsed.settings?.dailyMinutes ?? {},
        teams: parsed.settings?.teams?.length ? parsed.settings.teams : defaultSettings.teams,
        workdays: parsed.settings?.workdays?.length ? parsed.settings.workdays : defaultSettings.workdays,
      },
      rows: (parsed.rows ?? []).map((row, index) => ({
        ...row,
        priority: row.priority ?? index + 1,
        batch: row.batch ?? "",
      })),
      tab: parsed.tab ?? "config",
      visibleMonth: parsed.visibleMonth ?? monthKey(start),
      selectedDay: parsed.selectedDay ?? defaultSettings.startDate,
      actuals: parsed.actuals ?? {},
      customHolidayDate: defaultSettings.startDate,
      customHolidayName: "",
      teamFilter: parsed.teamFilter ?? 1,
    };
  } catch {
    return {
      settings: defaultSettings,
      rows: [] as PORecord[],
      tab: "config" as TabKey,
      visibleMonth: monthKey(start),
      selectedDay: toDateInputValue(start),
      actuals: {} as Record<string, string>,
      customHolidayDate: toDateInputValue(start),
      customHolidayName: "",
      teamFilter: 1,
    };
  }
}

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function numberValue(value: string, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function decimalValue(value: string, fallback = 0): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function displayNumber(value: number, digits = 2): string {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function dayLabelFromDate(dateValue: string) {
  return `${weekdayLabel(weekdayFromDate(dateValue))} ${formatVNDate(dateValue)}`;
}

export default function App() {
  const initial = loadInitialState();
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [rows, setRows] = useState<PORecord[]>(initial.rows);
  const [tab, setTab] = useState<TabKey>(initial.tab);
  const [visibleMonth, setVisibleMonth] = useState(initial.visibleMonth);
  const [selectedDay, setSelectedDay] = useState(initial.selectedDay);
  const [actuals, setActuals] = useState<Record<string, string>>(initial.actuals);
  const [customHolidayDate, setCustomHolidayDate] = useState(initial.customHolidayDate);
  const [customHolidayName, setCustomHolidayName] = useState("");
  const [teamFilter, setTeamFilter] = useState(initial.teamFilter);
  const [decimalDrafts, setDecimalDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings,
        rows,
        tab,
        visibleMonth,
        selectedDay,
        actuals,
        teamFilter,
      })
    );
  }, [settings, rows, tab, visibleMonth, selectedDay, actuals, teamFilter]);

  const schedule = useMemo<ScheduleResult | null>(() => {
    if (!rows.length) return null;
    return buildSchedule(rows, settings);
  }, [rows, settings]);

  const monthDate = useMemo(() => {
    const [year, month] = visibleMonth.split("-").map((part) => Number(part));
    return new Date(year, month - 1, 1);
  }, [visibleMonth]);

  const monthGrid = useMemo(
    () => buildMonthGrid(`${visibleMonth}-01`, selectedDay, settings.holidays, settings.workdays),
    [visibleMonth, selectedDay, settings.holidays, settings.workdays]
  );
  const summary = useMemo(() => summarizeJobs(rows), [rows]);

  const selectedDayPlans = schedule?.byDate.get(selectedDay) ?? [];
  const selectedTeamPlans = schedule?.byTeam.get(teamFilter) ?? [];
  const tableCounts = settings.teams.map((team) => team.tables);
  const minTables = tableCounts.length ? Math.min(...tableCounts) : 0;
  const maxTables = tableCounts.length ? Math.max(...tableCounts) : 0;
  const avgTables = tableCounts.length ? Math.round(tableCounts.reduce((sum, value) => sum + value, 0) / tableCounts.length) : 0;

  useEffect(() => {
    if (!settings.teams.length) return;
    const safeTeam = Math.min(Math.max(teamFilter, 1), settings.teams.length);
    if (safeTeam !== teamFilter) setTeamFilter(safeTeam);
  }, [settings.teams.length, teamFilter]);

  const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: "config", label: "Cấu hình", icon: "⚙" },
    { key: "calendar", label: "Lịch làm việc", icon: "📅" },
    { key: "input", label: "Nhập PO", icon: "📁" },
    { key: "plan", label: "Kế hoạch", icon: "🗓" },
    { key: "team", label: "Theo tổ", icon: "👥" },
    { key: "report", label: "Báo cáo", icon: "📊" },
  ];

  function updateTeam(index: number, patch: Partial<TeamConfig>) {
    setSettings((current) => {
      const nextTeams = [...current.teams];
      nextTeams[index] = { ...nextTeams[index], ...patch };
      return { ...current, teams: nextTeams };
    });
  }

  function setTeamCount(count: number) {
    setSettings((current) => {
      const next = makeDefaultTeams(count);
      for (let i = 0; i < Math.min(current.teams.length, next.length); i += 1) {
        next[i] = { ...next[i], tables: current.teams[i].tables, name: current.teams[i].name || next[i].name };
      }
      return { ...current, teams: next };
    });
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const parsed = await parseExcelRecords(file);
      setRows(parsed);
      if (parsed.length) {
        setSelectedDay(settings.startDate);
        setVisibleMonth(settings.startDate.slice(0, 7));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi import Excel.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function addHoliday() {
    if (!customHolidayDate || !customHolidayName.trim()) return;
    setSettings((current) => ({
      ...current,
      holidays: normalizeHolidayList([...current.holidays, { date: customHolidayDate, name: customHolidayName.trim() }]),
    }));
    setCustomHolidayName("");
  }

  function loadVNHolidays() {
    const year = parseDateInput(settings.startDate).getFullYear();
    setSettings((current) => ({
      ...current,
      holidays: normalizeHolidayList([
        ...current.holidays,
        ...loadVietnamHolidays(year),
        ...loadVietnamHolidays(year + 1),
      ]),
    }));
  }

  function addPORow() {
    setRows((current) => [
      ...current,
      {
        id: `row-${current.length + 1}`,
        priority: current.length + 1,
        batch: "",
        po: "",
        itemCode: "",
        color: "",
        quantity: 0,
        frontDm: 0,
        backDm: 0,
      },
    ]);
  }

  function updatePORow(index: number, patch: Partial<PORecord>) {
    setRows((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function updateDecimalDraft(index: number, field: "frontDm" | "backDm", value: string) {
    const row = rows[index];
    if (!row) return;
    const key = `${row.id}-${field}`;
    setDecimalDrafts((current) => ({ ...current, [key]: value }));
    if (/^\d*([.,]\d*)?$/.test(value) && value !== "" && !/[.,]$/.test(value)) {
      updatePORow(index, { [field]: decimalValue(value) });
    }
  }

  function commitDecimalDraft(index: number, field: "frontDm" | "backDm") {
    const row = rows[index];
    if (!row) return;
    const key = `${row.id}-${field}`;
    const draft = decimalDrafts[key];
    if (draft !== undefined) {
      updatePORow(index, { [field]: decimalValue(draft) });
      setDecimalDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function removePORow(index: number) {
    setRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function generateSampleRows() {
    setRows([
      { id: "row-1", priority: 1, batch: "Lô A", po: "PO2401", itemCode: "1105689", color: "HCH", quantity: 7200, frontDm: 16, backDm: 18 },
      { id: "row-2", priority: 2, batch: "Lô A", po: "PO2402", itemCode: "1105690", color: "DEN", quantity: 4800, frontDm: 25.4, backDm: 0 },
      { id: "row-3", priority: 3, batch: "Lô B", po: "PO2403", itemCode: "1105691", color: "TRANG", quantity: 9600, frontDm: 14, backDm: 15 },
    ]);
    setTab("input");
  }

  const baseRows = schedule ? schedule.rows : [];
  const byDayGroups = schedule ? [...schedule.byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])) : [];

  function exportExcel() {
    if (!schedule) return;
    exportScheduleToExcel(schedule, rows);
  }

  return (
    <div className="app-shell">
      <AppHeader
        tabs={tabs}
        activeTab={tab}
        onTabChange={(key) => setTab(key as TabKey)}
        onClearPO={() => setRows([])}
        onDownloadTemplate={downloadTemplate}
        onExport={exportExcel}
        canExport={Boolean(schedule)}
        error={error}
      />

      {tab === "config" ? (
        <section className="grid two-col">
          <div className="card">
            <div className="card-title">Cấu hình chung</div>
            <div className="form-grid">
              <label>
                <span>Phút/ngày</span>
                <input
                  type="number"
                  value={settings.minutesPerDay}
                  onChange={(e) => setSettings((current) => ({ ...current, minutesPerDay: numberValue(e.target.value, 483) }))}
                />
              </label>
              <label>
                <span>Phút ngày đang chọn / tăng ca</span>
                <input
                  type="number"
                  value={settings.dailyMinutes[selectedDay] ?? settings.minutesPerDay}
                  onChange={(e) => {
                    const minutes = numberValue(e.target.value, settings.minutesPerDay);
                    setSettings((current) => ({ ...current, dailyMinutes: { ...current.dailyMinutes, [selectedDay]: minutes } }));
                  }}
                />
                <small className="muted">{dayLabelFromDate(selectedDay)} · nhập 483, 540, 600...</small>
              </label>
              <label>
                <span>Số tổ</span>
                <input
                  type="number"
                  value={settings.teams.length}
                  onChange={(e) => setTeamCount(Math.max(1, numberValue(e.target.value, 15)))}
                />
              </label>
              <label>
                <span>Ngày bắt đầu</span>
                <input
                  type="date"
                  value={settings.startDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSettings((current) => ({ ...current, startDate: value }));
                    setSelectedDay(value);
                    setVisibleMonth(value.slice(0, 7));
                  }}
                />
              </label>
              <div className="button-stack">
                <button className="primary-button" onClick={() => setSettings((current) => ({ ...current, teams: [...current.teams] }))}>
                  Áp dụng
                </button>
                <button className="ghost-button" onClick={() => setSettings((current) => ({ ...current, teams: makeDefaultTeams(current.teams.length) }))}>
                  Reset bàn
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Số bàn từng tổ</div>
            <div className="team-grid">
              {settings.teams.map((team, index) => (
                <div className="team-card" key={team.id}>
                  <div className="team-card-header">
                    <span>{team.name}</span>
                    <small>{team.id}</small>
                  </div>
                  <input type="number" value={team.tables} onChange={(e) => updateTeam(index, { tables: numberValue(e.target.value, 120) })} />
                </div>
              ))}
            </div>
              <div className="stats-row">
              <div className="stat-card">
                <span>Tổng bàn</span>
                <strong>{settings.teams.reduce((sum, team) => sum + team.tables, 0).toLocaleString("vi-VN")}</strong>
              </div>
              <div className="stat-card">
                <span>Bình quân</span>
                <strong>{avgTables.toLocaleString("vi-VN")}</strong>
              </div>
              <div className="stat-card">
                <span>Min</span>
                <strong>{minTables.toLocaleString("vi-VN")}</strong>
              </div>
              <div className="stat-card">
                <span>Max</span>
                <strong>{maxTables.toLocaleString("vi-VN")}</strong>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "calendar" ? (
        <section className="grid two-col">
          <div className="card">
            <div className="card-title">Lịch làm việc</div>
            <div className="calendar-controls">
              <label>
                <span>Ngày bắt đầu sản xuất</span>
                <input type="date" value={settings.startDate} onChange={(e) => setSettings((current) => ({ ...current, startDate: e.target.value }))} />
              </label>
              <div>
                <span>Ngày làm việc trong tuần</span>
                <div className="weekday-buttons">
                  {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label, index) => (
                    <button
                      key={label}
                      className={cn("weekday-pill", settings.workdays.includes(index) && "active")}
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          workdays: current.workdays.includes(index)
                            ? current.workdays.filter((item) => item !== index)
                            : [...current.workdays, index].sort((a, b) => a - b),
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="holiday-box">
              <div className="card-subtitle">Thêm ngày nghỉ lễ / bất thường</div>
              <div className="holiday-form">
                <input type="date" value={customHolidayDate} onChange={(e) => setCustomHolidayDate(e.target.value)} />
                <input placeholder="Tên (vd: Tết, 30/4...)" value={customHolidayName} onChange={(e) => setCustomHolidayName(e.target.value)} />
                <button className="primary-button" onClick={addHoliday}>
                  + Thêm
                </button>
              </div>
              <div className="holiday-actions">
                <button className="ghost-button" onClick={loadVNHolidays}>
                  🇻🇳 Thêm lễ VN năm nay
                </button>
              </div>

              <div className="holiday-list">
                <div className="card-subtitle">Ngày nghỉ đã thêm</div>
                {settings.holidays.length ? (
                  settings.holidays.map((holiday) => (
                    <div className="holiday-row" key={`${holiday.date}-${holiday.name}`}>
                      <span>{formatVNDate(holiday.date)}</span>
                      <strong>{holiday.name}</strong>
                      <button className="text-button" onClick={() => setSettings((current) => ({ ...current, holidays: current.holidays.filter((item) => item.date !== holiday.date || item.name !== holiday.name) }))}>
                        Xóa
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="muted">Chưa có ngày nghỉ nào.</div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="calendar-header">
              <button
                className="ghost-button"
                onClick={() => {
                  const prev = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
                  setVisibleMonth(monthKey(prev));
                }}
              >
                ‹ Tháng trước
              </button>
              <div className="card-title">{`Tháng ${monthGrid.monthTitle}`}</div>
              <button
                className="ghost-button"
                onClick={() => {
                  const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
                  setVisibleMonth(monthKey(next));
                }}
              >
                Tháng sau ›
              </button>
            </div>
            <div className="calendar-weekdays">
              {monthGrid.weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {monthGrid.cells.map((cell, index) => (
                <button
                  key={`${cell.date}-${index}`}
                  className={cn("calendar-cell", cell.state, cell.date === selectedDay && "selected")}
                  disabled={!cell.date}
                  onClick={() => setSelectedDay(cell.date)}
                >
                  <span>{cell.label}</span>
                  {cell.state === "start" ? <small>Bắt đầu</small> : null}
                </button>
              ))}
            </div>
            <div className="legend">
              <span><i className="legend-dot work" />Làm việc</span>
              <span><i className="legend-dot holiday" />Nghỉ lễ</span>
              <span><i className="legend-dot weekend" />Cuối tuần</span>
              <span><i className="legend-dot selected" />Hôm nay</span>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "input" ? (
        <section className="grid one-col">
          <div className="card">
            <div className="card-title">Upload file Excel</div>
            <div className="dropzone">
              <input type="file" accept=".xlsx,.xls" onChange={handleUpload} />
              <div className="dropzone-copy">
                <div className="dropzone-icon">📊</div>
                <strong>Kéo thả hoặc click chọn file Excel</strong>
                <span>Cột: Ưu tiên · Lô · PO · Mã hàng · Màu vải · Số lượng · FRONT · BACK</span>
              </div>
            </div>
            <div className="input-actions">
              <button className="primary-button" onClick={generateSampleRows}>
                + Thêm dữ liệu mẫu
              </button>
              <button className="ghost-button" onClick={() => setRows([])}>
                🗑 Xóa tất cả
              </button>
            </div>
          </div>

          <div className="card">
            <div className="section-head">
              <div className="card-title">Danh sách PO</div>
              <div className="section-actions">
                <button className="ghost-button" onClick={addPORow}>
                  + Thêm
                </button>
                <button className="ghost-button" onClick={() => setRows([])}>
                  Xóa tất cả
                </button>
              </div>
            </div>

            <PODataTable
              rows={rows}
              decimalDrafts={decimalDrafts}
              onUpdate={updatePORow}
              onDecimalChange={updateDecimalDraft}
              onDecimalBlur={commitDecimalDraft}
              onRemove={removePORow}
            />
          </div>
        </section>
      ) : null}

      {tab === "plan" ? (
        <section className="grid one-col">
          <div className="card">
            <div className="section-head">
              <div>
                <div className="card-title">Kế hoạch theo ngày</div>
                <div className="muted">Ngày đang xem: {dayLabelFromDate(selectedDay)}</div>
              </div>
              <div className="section-actions">
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setVisibleMonth(e.target.value.slice(0, 7));
                  }}
                />
                <button
                  className="ghost-button"
                  onClick={() => {
                    setSelectedDay(settings.startDate);
                    setVisibleMonth(settings.startDate.slice(0, 7));
                  }}
                >
                  Về ngày bắt đầu
                </button>
              </div>
            </div>

            {schedule ? (
              <div className="timeline-list">
                {selectedDayPlans.length ? (
                  selectedDayPlans.map((teamDay) => (
                    <div className="timeline-card" key={`${teamDay.teamId}-${teamDay.date}`}>
                      <div className="timeline-head">
                        <div>
                          <strong>{teamDay.teamName}</strong>
                          <div className="muted">{teamDay.weekday} - {formatVNDate(teamDay.date)} - {teamDay.tables} bàn</div>
                        </div>
                        <div className="timeline-score">
                          <span>{displayNumber(teamDay.totalMinutes)}p / {displayNumber(teamDay.capacityMinutes)}p</span>
                          <strong>{teamDay.fillRate}%</strong>
                        </div>
                      </div>
                      <ProgressBar mainMinutes={teamDay.mainMinutes} extraMinutes={teamDay.extraMinutes} capacityMinutes={teamDay.capacityMinutes} />
                      <div className="row-mini-grid">
                        {teamDay.rows.map((row) => (
                          <div className={cn("job-chip", row.type === "Chính" ? "main" : "mix")} key={row.key}>
                            <strong>{row.type}</strong>
                            <span>{row.itemCode} / {row.color} / {row.role}</span>
                            <small>Ưu tiên {row.priority} · {row.batch || "Không lô"} · {row.sourceTeamName ? `Mượn ${row.sourceTeamName} · ` : ""}{row.groupTotalQty ? `Nhóm đủ ${row.groupTotalQty.toLocaleString("vi-VN")} pcs / ${row.groupRounds ?? row.rounds} lượt · ` : ""}ĐM {displayNumber(row.dm)}p · Lượt {row.rounds} · Phút {displayNumber(row.minutes)} · SL {row.plannedQty.toLocaleString("vi-VN")}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Chưa có kế hoạch cho ngày này.</div>
                )}
              </div>
            ) : (
              <div className="empty-state">Nhập PO trước để tạo kế hoạch.</div>
            )}
          </div>

          <div className="card">
            <div className="section-head">
              <div className="card-title">Kế hoạch tổng</div>
              <div className="muted">{baseRows.length.toLocaleString("vi-VN")} dòng kế hoạch</div>
            </div>
            <div className="table-wrap">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Tổ</th>
                    <th>Loại</th>
                    <th>Mã</th>
                    <th>Màu</th>
                    <th>Vai trò</th>
                    <th>ĐM</th>
                    <th>Lượt</th>
                    <th>Phút</th>
                    <th>SL hôm nay</th>
                    <th>Còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {baseRows.length ? (
                    baseRows.map((row) => (
                      <tr key={row.key}>
                        <td>{formatVNDate(row.date)}</td>
                        <td>{row.teamName}</td>
                        <td>{row.type}</td>
                        <td>{row.itemCode}</td>
                        <td>{row.color}</td>
                        <td>{row.role}</td>
                        <td>{displayNumber(row.dm)}p</td>
                        <td>{row.rounds}</td>
                        <td>{displayNumber(row.minutes)}p</td>
                        <td>{row.plannedQty.toLocaleString("vi-VN")}</td>
                        <td>{row.remainingEnd.toLocaleString("vi-VN")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="empty-state">Chưa có dữ liệu kế hoạch.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "team" ? (
        <section className="grid one-col">
          <div className="card">
            <div className="section-head">
              <div className="card-title">Theo tổ</div>
              <div className="section-actions">
                <select value={teamFilter} onChange={(e) => setTeamFilter(numberValue(e.target.value, 1))}>
                  {settings.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="muted">
              Hiển thị toàn bộ lịch cho {settings.teams.find((team) => team.id === teamFilter)?.name ?? `Tổ ${teamFilter}`}
            </div>
            <div className="table-wrap">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Ngày thực</th>
                    <th>Thứ</th>
                    <th>Loại</th>
                    <th>Mã</th>
                    <th>Màu</th>
                    <th>Vai trò</th>
                    <th>ĐM</th>
                    <th>Lượt</th>
                    <th>Phút</th>
                    <th>SL hôm nay</th>
                    <th>Còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTeamPlans.length ? (
                    selectedTeamPlans.map((row) => (
                      <tr key={row.key}>
                        <td>{formatVNDate(row.date)}</td>
                        <td>{row.weekday}</td>
                        <td>{row.type}</td>
                        <td>{row.itemCode}</td>
                        <td>{row.color}</td>
                        <td>{row.role}</td>
                        <td>{displayNumber(row.dm)}p</td>
                        <td>{row.rounds}</td>
                        <td>{displayNumber(row.minutes)}p</td>
                        <td>{row.plannedQty.toLocaleString("vi-VN")}</td>
                        <td>{row.remainingEnd.toLocaleString("vi-VN")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="empty-state">Chưa có dữ liệu cho tổ này.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "report" ? (
        <section className="grid two-col">
          <div className="card">
            <div className="section-head">
              <div>
                <div className="card-title">Báo cáo năng suất hằng ngày</div>
                <div className="muted">Chọn ngày cụ thể để nhập thực tế</div>
              </div>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => {
                  setSelectedDay(e.target.value);
                  setVisibleMonth(e.target.value.slice(0, 7));
                }}
              />
            </div>

            <div className="report-list">
              {selectedDayPlans.length ? (
                selectedDayPlans.map((teamDay) => {
                  const planQty = teamDay.rows.reduce((sum, row) => sum + row.plannedQty, 0);
                  const actual = numberValue(actuals[String(teamDay.teamId)] ?? "", 0);
                  const percent = planQty > 0 ? Math.round((actual / planQty) * 100) : 0;
                  const actualRounds = teamDay.tables > 0 ? Math.floor(actual / teamDay.tables) : 0;
                  const status = percent >= 100 ? "✓ Đạt" : percent >= 90 ? "Gần đạt" : "Chưa đạt";
                  return (
                    <div className="report-card" key={`${teamDay.teamId}-${teamDay.date}`}>
                      <div className="timeline-head">
                        <div>
                          <strong>{teamDay.teamName}</strong>
                          <div className="muted">{formatVNDate(teamDay.date)} - KH {planQty.toLocaleString("vi-VN")} pcs</div>
                        </div>
                        <div className="timeline-score">
                          <span>{status}</span>
                          <strong>{percent}%</strong>
                        </div>
                      </div>
                      <div className="report-inputs">
                        <label>
                          <span>Thực tế (pcs)</span>
                          <input
                            type="number"
                            value={actuals[String(teamDay.teamId)] ?? ""}
                            onChange={(e) => setActuals((current) => ({ ...current, [String(teamDay.teamId)]: e.target.value }))}
                          />
                        </label>
                        <label>
                          <span>Lượt thực tế</span>
                          <input type="text" value={actualRounds.toLocaleString("vi-VN")} readOnly />
                        </label>
                      </div>
                      <div className="report-meta">
                        <span>Đánh giá: <strong>{status}</strong></span>
                        <span>% đạt: <strong>{percent}%</strong></span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">Chưa có kế hoạch cho ngày này.</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Tổng quan dữ liệu</div>
            <div className="stats-row">
              <div className="stat-card">
                <span>Số dòng PO</span>
                <strong>{rows.length.toLocaleString("vi-VN")}</strong>
              </div>
              <div className="stat-card">
                <span>Job FRONT</span>
                <strong>{summary.frontCount.toLocaleString("vi-VN")}</strong>
              </div>
              <div className="stat-card">
                <span>Job BACK</span>
                <strong>{summary.backCount.toLocaleString("vi-VN")}</strong>
              </div>
              <div className="stat-card">
                <span>Tổng SL</span>
                <strong>{summary.totalQuantity.toLocaleString("vi-VN")}</strong>
              </div>
            </div>

            <div className="muted" style={{ marginBottom: 12 }}>
              Kế hoạch sẽ chạy theo ngày làm việc thực tế, bỏ qua cuối tuần và các ngày nghỉ đã thêm.
            </div>

            <div className="section-head">
              <div className="card-title">Xuất Excel</div>
              <button className="primary-button" onClick={exportExcel} disabled={!schedule}>
                Xuất file kế hoạch
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "plan" && schedule ? (
        <section className="card">
          <div className="section-head">
            <div className="card-title">Kế hoạch theo ngày</div>
            <div className="muted">{byDayGroups.length.toLocaleString("vi-VN")} ngày làm việc</div>
          </div>
          <div className="timeline-list">
            {byDayGroups.map(([date, teams]) => (
              <details key={date} className="day-group" open={date === selectedDay}>
                <summary>
                  <strong>{formatVNDate(date)}</strong>
                  <span>{weekdayLabel(weekdayFromDate(date))}</span>
                  <span>{teams.length} tổ</span>
                </summary>
                <div className="day-group-body">
                  {teams.map((teamDay) => (
                    <div className="timeline-card compact" key={`${date}-${teamDay.teamId}`}>
                      <div className="timeline-head">
                        <div>
                          <strong>{teamDay.teamName}</strong>
                          <div className="muted">{teamDay.rows.length} dòng · {displayNumber(teamDay.totalMinutes)} / {displayNumber(teamDay.capacityMinutes)}p</div>
                        </div>
                        <div className="timeline-score">
                          <span>{teamDay.fillRate}%</span>
                          <strong>{displayNumber(teamDay.totalMinutes)}p</strong>
                        </div>
                      </div>
                      <ProgressBar mainMinutes={teamDay.mainMinutes} extraMinutes={teamDay.extraMinutes} capacityMinutes={teamDay.capacityMinutes} />
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {busy ? <div className="loading-pill">Đang xử lý file Excel...</div> : null}
    </div>
  );
}
