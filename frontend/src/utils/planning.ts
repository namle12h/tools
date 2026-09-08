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
        priority: row.priority,
        batch: row.batch,
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
        priority: row.priority,
        batch: row.batch,
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

function batchKey(job: JobItem): string {
  return job.batch.trim().toLocaleUpperCase();
}

function sortBatchKeys(a: string, b: string): number {
  if (!a && b) return 1;
  if (a && !b) return -1;
  return a.localeCompare(b, "vi");
}

function assignJobs(jobs: JobItem[], teams: TeamConfig[]): Map<number, JobItem[]> {
  const assigned = new Map<number, JobItem[]>();
  const teamLoads = new Map<number, number>(teams.map((team) => [team.id, 0]));
  const sortedJobs = [...jobs].sort((a, b) => {
    const batchOrder = sortBatchKeys(batchKey(a), batchKey(b));
    if (batchOrder !== 0) return batchOrder;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return totalLoad(b) - totalLoad(a);
  });
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
    list.sort((a, b) => {
      const batchOrder = sortBatchKeys(batchKey(a), batchKey(b));
      if (batchOrder !== 0) return batchOrder;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return totalLoad(b) - totalLoad(a);
    });
  }

  return assigned;
}

function currentMainJob(queue: JobItem[], reservedJobs: Set<string>, activeBatch: string): JobItem | undefined {
  return queue.find((job) => job.remaining > 0 && !reservedJobs.has(job.id) && batchKey(job) === activeBatch);
}

function findAuxiliaryJob(args: {
  jobs: JobItem[];
  team: TeamConfig;
  teams: TeamConfig[];
  main?: JobItem;
  remainingMinutes: number;
  reservedJobs: Set<string>;
  releasedTeamIds: Set<number>;
  activeBatch: string;
}): { job?: JobItem; sourceTeamName?: string } {
  const { jobs, team, teams, main, remainingMinutes, reservedJobs, releasedTeamIds, activeBatch } = args;
  const candidates = jobs.filter(
    (job) =>
      job.remaining > 30 &&
      job.id !== main?.id &&
      !reservedJobs.has(job.id) &&
      job.dm <= remainingMinutes &&
      batchKey(job) === activeBatch &&
      (job.assignedTeamId === undefined || releasedTeamIds.has(job.assignedTeamId))
  );
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.batch !== b.batch) return a.batch.localeCompare(b.batch);
    const remA = remainingMinutes % a.dm;
    const remB = remainingMinutes % b.dm;
    if (remA !== remB) return remA - remB;
    if (a.dm !== b.dm) return b.dm - a.dm;
    if (b.remaining !== a.remaining) return b.remaining - a.remaining;
    return a.id.localeCompare(b.id);
  });
  const job = sorted[0];
  const sourceTeamName = job && job.assignedTeamId !== team.id
    ? teams.find((item) => item.id === job.assignedTeamId)?.name
    : undefined;
  return { job, sourceTeamName };
}

function findComplementaryJobs(args: {
  jobs: JobItem[];
  pick: JobItem;
  team: TeamConfig;
  reservedJobs: Set<string>;
  releasedTeamIds: Set<number>;
  activeBatch: string;
}): Array<{ job: JobItem; quantity: number }> {
  const { jobs, pick, team, reservedJobs, releasedTeamIds, activeBatch } = args;
  if (pick.remaining >= team.tables) return [];

  let needed = team.tables - pick.remaining;
  const candidates = jobs
    .filter(
      (job) =>
        job.id !== pick.id &&
        job.remaining > 30 &&
        !reservedJobs.has(job.id) &&
        job.assignedTeamId !== team.id &&
        batchKey(job) === activeBatch &&
        (job.assignedTeamId === undefined || releasedTeamIds.has(job.assignedTeamId)) &&
        Math.abs(job.dm - pick.dm) <= 10
    )
    .sort((a, b) => {
      const diffA = Math.abs(a.dm - pick.dm);
      const diffB = Math.abs(b.dm - pick.dm);
      if (diffA !== diffB) return diffA - diffB;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id.localeCompare(b.id);
    });

  const parts: Array<{ job: JobItem; quantity: number }> = [];
  for (const candidate of candidates) {
    const quantity = Math.min(candidate.remaining, needed);
    if (quantity <= 0) continue;
    parts.push({ job: candidate, quantity });
    needed -= quantity;
    if (needed <= 0) break;
  }

  return needed <= 0 ? parts : [];
}

function findRemainderPartner(args: {
  jobs: JobItem[];
  main: JobItem;
  team: TeamConfig;
  neededQuantity: number;
  reservedJobs: Set<string>;
  releasedTeamIds: Set<number>;
  activeBatch: string;
}): JobItem | undefined {
  const { jobs, main, team, neededQuantity, reservedJobs, releasedTeamIds, activeBatch } = args;
  return jobs
    .filter(
      (job) =>
        job.id !== main.id &&
        job.rowId !== main.rowId &&
        job.remaining >= neededQuantity &&
        !reservedJobs.has(job.id) &&
        job.assignedTeamId !== team.id &&
        batchKey(job) === activeBatch &&
        (job.assignedTeamId === undefined || releasedTeamIds.has(job.assignedTeamId)) &&
        Math.abs(job.dm - main.dm) <= 20
    )
    .sort((a, b) => {
      const diffA = Math.abs(a.dm - main.dm);
      const diffB = Math.abs(b.dm - main.dm);
      if (diffA !== diffB) return diffA - diffB;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id.localeCompare(b.id);
    })[0];
}

function makePlanRow(args: {
  date: string;
  team: TeamConfig;
  type: "Chính" | "Ghép";
  job: JobItem;
  sourceTeamName?: string;
  groupId?: string;
  groupTotalQty?: number;
  groupRounds?: number;
  remainingStart: number;
  plannedQty: number;
  rounds: number;
  minutes: number;
  remainingEnd: number;
}): PlanRow {
  const { date, team, type, job, sourceTeamName, groupId, groupTotalQty, groupRounds, remainingStart, plannedQty, rounds, minutes, remainingEnd } = args;
  const weekday = weekdayLabel(weekdayFromDate(date));
  return {
    key: `${date}-${team.id}-${job.id}-${type}-${remainingStart}-${plannedQty}`,
    date,
    weekday,
    teamId: team.id,
    teamName: team.name,
    tables: team.tables,
    type,
    priority: job.priority,
    batch: job.batch,
    sourceTeamName,
    groupId,
    groupTotalQty,
    groupRounds,
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
  const batchOrder = [...new Set(jobs.map(batchKey))].sort(sortBatchKeys);
  let activeBatchIndex = 0;

  const start = parseDateInput(settings.startDate);
  let current = start;
  const maxDays = 2500;
  let guard = 0;

  const hasRemainingJobs = () => jobs.some((job) => job.remaining > 0);

  const advanceCompletedBatches = () => {
    while (
      activeBatchIndex < batchOrder.length &&
      jobs.filter((job) => batchKey(job) === batchOrder[activeBatchIndex]).every((job) => job.remaining <= 0)
    ) {
      activeBatchIndex += 1;
    }
  };

  while (hasRemainingJobs() && guard < maxDays) {
    if (!isWorkingDate(current, settings.workdays, settings.holidays)) {
      current = nextWorkingDate(current, settings.workdays, settings.holidays);
      guard += 1;
      continue;
    }

    const dateKey = formatVNDate(current).split("/").reverse().join("-");
    const dailyCapacity = Math.max(0, settings.dailyMinutes[dateKey] ?? settings.minutesPerDay);
    const daySummaries = new Map<number, TeamDaySummary>();
    const reservedJobs = new Set<string>();
    const releasedTeamIds = new Set<number>();
    let batchPass = 0;

    while (batchPass < batchOrder.length && hasRemainingJobs()) {
      advanceCompletedBatches();
      const activeBatch = batchOrder[activeBatchIndex];
      if (activeBatch === undefined) break;
      let passProgress = false;

      for (const team of teams) {
      const queue = queueMap.get(team.id) ?? [];
      const main = currentMainJob(queue, reservedJobs, activeBatch);
      const rowsForTeam: PlanRow[] = [];
      const previousSummary = daySummaries.get(team.id);
      const usedMinutes = previousSummary?.totalMinutes ?? 0;
      const availableCapacity = Math.max(0, dailyCapacity - usedMinutes);
      let mainMinutes = 0;
      let extraMinutes = 0;

      if (main && main.remaining > 0) {
        const remainingStart = main.remaining;
        const fullRounds = Math.floor(availableCapacity / main.dm);
        const fullDayQty = fullRounds * team.tables;

        if (fullRounds > 0) {
          if (remainingStart > fullDayQty) {
          const plannedQty = fullDayQty;
          const minutes = fullRounds * main.dm;
          main.remaining = remainingStart - plannedQty;
          if (main.remaining <= 30) main.remaining = 0;
          const mainRow = makePlanRow({
            date: dateKey,
            team,
            type: "Chính",
            job: main,
            remainingStart,
            plannedQty,
            rounds: fullRounds,
            minutes,
            remainingEnd: main.remaining,
          });
          rowsForTeam.push(mainRow);
          resultRows.push(mainRow);
          mainMinutes += minutes;
        } else {
          const neededRounds = Math.max(1, Math.ceil(remainingStart / team.tables));
          const roundedQty = neededRounds * team.tables;
          const missingQuantity = roundedQty - remainingStart;
          const partner = missingQuantity > 0
            ? findRemainderPartner({ jobs, main, team, neededQuantity: missingQuantity, reservedJobs, releasedTeamIds, activeBatch })
            : undefined;

          if (partner) {
            const groupId = `${dateKey}-${team.id}-completion-${main.id}`;
            const mainMinutesForGroup = (remainingStart / roundedQty) * neededRounds * main.dm;
            const partnerMinutesForGroup = (missingQuantity / roundedQty) * neededRounds * partner.dm;
            const partnerRemainingStart = partner.remaining;
            main.remaining = 0;
            partner.remaining = Math.max(0, partner.remaining - missingQuantity);
            if (partner.remaining <= 30) partner.remaining = 0;

            const mainRow = makePlanRow({
              date: dateKey,
              team,
              type: "Chính",
              job: main,
              groupId,
              groupTotalQty: roundedQty,
              groupRounds: neededRounds,
              remainingStart,
              plannedQty: remainingStart,
              rounds: neededRounds,
              minutes: mainMinutesForGroup,
              remainingEnd: 0,
            });
            const partnerRow = makePlanRow({
              date: dateKey,
              team,
              type: "Ghép",
              job: partner,
              sourceTeamName: teams.find((item) => item.id === partner.assignedTeamId)?.name,
              groupId,
              groupTotalQty: roundedQty,
              groupRounds: neededRounds,
              remainingStart: partnerRemainingStart,
              plannedQty: missingQuantity,
              rounds: 0,
              minutes: partnerMinutesForGroup,
              remainingEnd: partner.remaining,
            });
            rowsForTeam.push(mainRow, partnerRow);
            resultRows.push(mainRow, partnerRow);
            mainMinutes += mainMinutesForGroup;
            extraMinutes += partnerMinutesForGroup;
            reservedJobs.add(main.id);
            reservedJobs.add(partner.id);
          } else {
            const plannedQty = missingQuantity <= 30 ? roundedQty : remainingStart;
            const minutes = neededRounds * main.dm;
            const remainingEnd = Math.max(0, remainingStart - plannedQty);
            main.remaining = remainingEnd;
            if (main.remaining <= 30) main.remaining = 0;
            const mainRow = makePlanRow({
              date: dateKey,
              team,
              type: "Chính",
              job: main,
              remainingStart,
              plannedQty,
              rounds: neededRounds,
              minutes,
              remainingEnd: main.remaining,
            });
            rowsForTeam.push(mainRow);
            resultRows.push(mainRow);
            mainMinutes += minutes;
          }
          }
        }
      }

      releasedTeamIds.add(team.id);
      let remainingMinutes = Math.max(0, availableCapacity - mainMinutes - extraMinutes);
      let loopCount = 0;
      while (remainingMinutes > 0 && loopCount < 15) {
        const choice = findAuxiliaryJob({ jobs, team, teams, main, remainingMinutes, reservedJobs, releasedTeamIds, activeBatch });
        const pick = choice.job;
        if (!pick) break;

        const groupParts = findComplementaryJobs({ jobs, pick, team, reservedJobs, releasedTeamIds, activeBatch });
        if (pick.remaining < team.tables && groupParts.length) {
          const groupId = `${dateKey}-${team.id}-group-${loopCount + 1}`;
          const groupTotalQty = team.tables;
          const groupRows: PlanRow[] = [];
          const pickQty = pick.remaining;
          const groupMinutes = groupParts.reduce((sum, part) => sum + (part.quantity / team.tables) * part.job.dm, (pickQty / team.tables) * pick.dm);

          if (groupMinutes > remainingMinutes) break;

          const pickRemainingStart = pick.remaining;
          pick.remaining = 0;
          const pickRow = makePlanRow({
            date: dateKey,
            team,
            type: "Ghép",
            job: pick,
            sourceTeamName: choice.sourceTeamName,
            groupId,
            groupTotalQty,
            remainingStart: pickRemainingStart,
            plannedQty: pickQty,
            rounds: 1,
            minutes: (pickQty / team.tables) * pick.dm,
            remainingEnd: 0,
          });
          groupRows.push(pickRow);
          reservedJobs.add(pick.id);

          for (const part of groupParts) {
            const partRemainingStart = part.job.remaining;
            part.job.remaining = Math.max(0, part.job.remaining - part.quantity);
            if (part.job.remaining <= 30) part.job.remaining = 0;
            const partRow = makePlanRow({
              date: dateKey,
              team,
              type: "Ghép",
              job: part.job,
              sourceTeamName: teams.find((item) => item.id === part.job.assignedTeamId)?.name,
              groupId,
              groupTotalQty,
              remainingStart: partRemainingStart,
              plannedQty: part.quantity,
              rounds: 1,
              minutes: (part.quantity / team.tables) * part.job.dm,
              remainingEnd: part.job.remaining,
            });
            groupRows.push(partRow);
            reservedJobs.add(part.job.id);
          }

          rowsForTeam.push(...groupRows);
          resultRows.push(...groupRows);
          extraMinutes += groupMinutes;
          remainingMinutes = Math.max(0, remainingMinutes - groupMinutes);
          loopCount += 1;
          continue;
        }

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
          sourceTeamName: choice.sourceTeamName,
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
        passProgress = true;
        const totalMinutes = mainMinutes + extraMinutes;
        const summary: TeamDaySummary = {
          date: dateKey,
          weekday: weekdayLabel(weekdayFromDate(current)),
          teamId: team.id,
          teamName: team.name,
          tables: team.tables,
          capacityMinutes: dailyCapacity,
          rows: rowsForTeam,
          mainMinutes,
          extraMinutes,
          totalMinutes,
          fillRate: dailyCapacity > 0 ? Math.min(100, Math.round((totalMinutes / dailyCapacity) * 100)) : 0,
        };
        const previous = daySummaries.get(team.id);
        daySummaries.set(team.id, previous
          ? {
              ...previous,
              rows: [...previous.rows, ...rowsForTeam],
              mainMinutes: previous.mainMinutes + mainMinutes,
              extraMinutes: previous.extraMinutes + extraMinutes,
              totalMinutes: previous.totalMinutes + totalMinutes,
              fillRate: dailyCapacity > 0
                ? Math.min(100, Math.round(((previous.totalMinutes + totalMinutes) / dailyCapacity) * 100))
                : 0,
            }
          : summary);
      }
    }

      advanceCompletedBatches();
      if (!passProgress) break;
      batchPass += 1;
    }

    for (const summary of daySummaries.values()) {
      teamDays.push(summary);

      const existingDate = byDate.get(dateKey) ?? [];
      existingDate.push(summary);
      byDate.set(dateKey, existingDate);

      const existingTeam = byTeam.get(summary.teamId) ?? [];
      existingTeam.push(...summary.rows);
      byTeam.set(summary.teamId, existingTeam);
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
