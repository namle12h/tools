import type { AppSettings, HolidayItem, JobItem, PORecord, PlanRow, ScheduleResult, TeamConfig, TeamDaySummary } from "../types";
import { formatVNDate, parseDateInput, weekdayLabel, weekdayFromDate } from "./date";
import { isWorkingDate, nextWorkingDate } from "./calendar";

function cloneJobs(rows: PORecord[]): JobItem[] {
  const jobs: JobItem[] = [];

  rows.forEach((row, index) => {
    const rowId = `record-${index + 1}`;
    const frontId = row.frontDm > 0 ? `${rowId}-front` : "";
    const backId = row.backDm > 0 ? `${rowId}-back` : "";

    if (row.frontDm > 0 && row.quantity > 0) {
      jobs.push({
        id: frontId,
        rowId,
        po: row.po,
        itemCode: row.itemCode,
        color: row.color,
        role: "FRONT",
        dm: row.frontDm,
        quantity: row.quantity,
        remaining: row.quantity,
        siblingId: backId || undefined,
        loadScore: row.quantity * row.frontDm,
      });
    }

    if (row.backDm > 0 && row.quantity > 0) {
      jobs.push({
        id: backId,
        rowId,
        po: row.po,
        itemCode: row.itemCode,
        color: row.color,
        role: "BACK",
        dm: row.backDm,
        quantity: row.quantity,
        remaining: row.quantity,
        siblingId: frontId || undefined,
        loadScore: row.quantity * row.backDm,
      });
    }
  });

  return jobs;
}

function totalLoad(job: JobItem): number {
  return job.loadScore;
}

function pickTeam(job: JobItem, teams: TeamConfig[], teamLoads: Map<number, number>): number {
  const takenTeam = job.siblingId ? undefined : undefined;
  const ranking = [...teams].sort((a, b) => {
    const loadA = teamLoads.get(a.id) ?? 0;
    const loadB = teamLoads.get(b.id) ?? 0;
    if (loadA !== loadB) return loadA - loadB;
    if (b.tables !== a.tables) return b.tables - a.tables;
    return a.id - b.id;
  });

  return ranking[0]?.id ?? teams[0]?.id ?? 0;
}

function assignJobs(jobs: JobItem[], teams: TeamConfig[]): Map<number, JobItem[]> {
  const assigned = new Map<number, JobItem[]>();
  const teamLoads = new Map<number, number>(teams.map((team) => [team.id, 0]));
  const sortedJobs = [...jobs].sort((a, b) => totalLoad(b) - totalLoad(a));
  const jobToTeam = new Map<string, number>();

  for (const job of sortedJobs) {
    const ranking = [...teams].sort((a, b) => {
      const loadA = teamLoads.get(a.id) ?? 0;
      const loadB = teamLoads.get(b.id) ?? 0;
      if (loadA !== loadB) return loadA - loadB;
      if (b.tables !== a.tables) return b.tables - a.tables;
      return a.id - b.id;
    });

    const siblingTeamId = job.siblingId ? jobToTeam.get(job.siblingId) : undefined;
    const chosen = ranking.find((team) => team.id !== siblingTeamId) ?? ranking[0];
    if (!chosen) continue;

    job.assignedTeamId = chosen.id;
    jobToTeam.set(job.id, chosen.id);
    const list = assigned.get(chosen.id) ?? [];
    list.push(job);
    assigned.set(chosen.id, list);
    teamLoads.set(chosen.id, (teamLoads.get(chosen.id) ?? 0) + totalLoad(job));
  }

  for (const list of assigned.values()) {
    list.sort((a, b) => totalLoad(b) - totalLoad(a));
  }

  return assigned;
}

function currentMainJob(queue: JobItem[]): JobItem | undefined {
  return queue.find((job) => job.remaining > 0);
}

function makePlanRow(args: {
  date: string;
  team: TeamConfig;
  type: "Chính" | "Ghép";
  job: JobItem;
  remainingStart: number;
  plannedQty: number;
  rounds: number;
  minutes: number;
  remainingEnd: number;
}): PlanRow {
  const { date, team, type, job, remainingStart, plannedQty, rounds, minutes, remainingEnd } = args;
  const weekday = weekdayLabel(weekdayFromDate(date));
  return {
    key: `${date}-${team.id}-${job.id}-${type}-${remainingStart}-${plannedQty}`,
    date,
    weekday,
    teamId: team.id,
    teamName: team.name,
    tables: team.tables,
    type,
    po: job.po,
    itemCode: job.itemCode,
    color: job.color,
    role: job.role === "FRONT" ? "Thân trước" : "Thân sau",
    dm: job.dm,
    rounds,
    minutes,
    plannedQty,
    remainingStart,
    remainingEnd,
    jobId: job.id,
    jobRemainingAfter: remainingEnd,
  };
}

export function buildSchedule(rows: PORecord[], settings: AppSettings): ScheduleResult {
  const jobs = cloneJobs(rows).filter((job) => job.dm > 0 && job.quantity > 0);
  const teams = settings.teams.length
    ? settings.teams
    : [{ id: 1, name: "Tổ 1", tables: 120 }];
  const assigned = assignJobs(jobs, teams);
  const queueMap = new Map<number, JobItem[]>(teams.map((team) => [team.id, assigned.get(team.id) ?? []]));
  const resultRows: PlanRow[] = [];
  const teamDays: TeamDaySummary[] = [];
  const byDate = new Map<string, TeamDaySummary[]>();
  const byTeam = new Map<number, PlanRow[]>();

  const start = parseDateInput(settings.startDate);
  let current = start;
  const maxDays = 2500;
  let guard = 0;

  const hasRemainingJobs = () => jobs.some((job) => job.remaining > 0);

  while (hasRemainingJobs() && guard < maxDays) {
    if (!isWorkingDate(current, settings.workdays, settings.holidays)) {
      current = nextWorkingDate(current, settings.workdays, settings.holidays);
      guard += 1;
      continue;
    }

    const dateKey = formatVNDate(current).split("/").reverse().join("-");
    const daySummaries: TeamDaySummary[] = [];
    const reservedJobs = new Set<string>();
    const dayCurrent = current;

    for (const team of teams) {
      const queue = queueMap.get(team.id) ?? [];
      const main = currentMainJob(queue);
      const rowsForTeam: PlanRow[] = [];
      let mainMinutes = 0;
      let extraMinutes = 0;

      if (main && main.remaining > 0) {
        const remainingStart = main.remaining;
        const fullRounds = Math.floor(settings.minutesPerDay / main.dm);
        const fullDayQty = fullRounds * team.tables;

        let plannedQty = 0;
        let rounds = 0;
        let minutes = 0;
        let remainingEnd = remainingStart;

        if (remainingStart > fullDayQty) {
          rounds = fullRounds;
          plannedQty = fullDayQty;
          minutes = rounds * main.dm;
          remainingEnd = remainingStart - plannedQty;
        } else {
          const neededRounds = Math.max(1, Math.ceil(remainingStart / team.tables));
          const roundedQty = neededRounds * team.tables;
          if (roundedQty - remainingStart <= 30) {
            rounds = neededRounds;
            plannedQty = roundedQty;
          } else {
            rounds = neededRounds;
            plannedQty = remainingStart;
          }
          minutes = rounds * main.dm;
          remainingEnd = Math.max(0, remainingStart - plannedQty);
        }

        main.remaining = remainingEnd;
        const mainRow = makePlanRow({
          date: dateKey,
          team,
          type: "Chính",
          job: main,
          remainingStart,
          plannedQty,
          rounds,
          minutes,
          remainingEnd,
        });
        rowsForTeam.push(mainRow);
        resultRows.push(mainRow);
        mainMinutes += minutes;

        if (main.remaining <= 30) {
          main.remaining = 0;
        }
      }

      let remainingMinutes = Math.max(0, settings.minutesPerDay - mainMinutes);
      let loopCount = 0;
      while (remainingMinutes > 0 && loopCount < 15) {
        const candidates = jobs
          .filter((job) => job.remaining > 30 && job.id !== main?.id && !reservedJobs.has(job.id) && job.dm <= remainingMinutes)
          .sort((a, b) => {
            const remA = remainingMinutes % a.dm;
            const remB = remainingMinutes % b.dm;
            if (remA !== remB) return remA - remB;
            if (a.dm !== b.dm) return b.dm - a.dm;
            if (b.remaining !== a.remaining) return b.remaining - a.remaining;
            return a.id.localeCompare(b.id);
          });

        const pick = candidates[0];
        if (!pick) break;

        const remainingStart = pick.remaining;
        const fullRounds = Math.floor(remainingMinutes / pick.dm);
        if (fullRounds <= 0) break;

        const capacity = fullRounds * team.tables;
        const plannedQty = Math.min(capacity, remainingStart);
        const rounds = Math.max(1, Math.ceil(plannedQty / team.tables));
        const minutes = rounds * pick.dm;
        const remainingEnd = Math.max(0, remainingStart - plannedQty);

        pick.remaining = remainingEnd;
        if (pick.remaining <= 30) {
          pick.remaining = 0;
        }
        const row = makePlanRow({
          date: dateKey,
          team,
          type: "Ghép",
          job: pick,
          remainingStart,
          plannedQty,
          rounds,
          minutes,
          remainingEnd,
        });
        rowsForTeam.push(row);
        resultRows.push(row);
        extraMinutes += minutes;
        remainingMinutes = Math.max(0, remainingMinutes - minutes);
        reservedJobs.add(pick.id);
        loopCount += 1;
      }

      if (rowsForTeam.length > 0) {
        const totalMinutes = mainMinutes + extraMinutes;
        const summary: TeamDaySummary = {
          date: dateKey,
          weekday: weekdayLabel(weekdayFromDate(current)),
          teamId: team.id,
          teamName: team.name,
          tables: team.tables,
          rows: rowsForTeam,
          mainMinutes,
          extraMinutes,
          totalMinutes,
          fillRate: Math.min(100, Math.round((totalMinutes / settings.minutesPerDay) * 100)),
        };
        daySummaries.push(summary);
        teamDays.push(summary);

        const existingDate = byDate.get(dateKey) ?? [];
        existingDate.push(summary);
        byDate.set(dateKey, existingDate);

        const existingTeam = byTeam.get(team.id) ?? [];
        existingTeam.push(...rowsForTeam);
        byTeam.set(team.id, existingTeam);
      }
    }

    current = nextWorkingDate(current, settings.workdays, settings.holidays);
    guard += 1;
  }

  return {
    jobs,
    rows: resultRows,
    teamDays,
    byDate,
    byTeam,
  };
}

export function summarizeJobs(jobs: PORecord[]) {
  const frontCount = jobs.filter((job) => job.frontDm > 0).length;
  const backCount = jobs.filter((job) => job.backDm > 0).length;
  const totalQuantity = jobs.reduce((sum, job) => sum + job.quantity, 0);
  return { frontCount, backCount, totalQuantity };
}
