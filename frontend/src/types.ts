export type Role = "FRONT" | "BACK";
export type PlanType = "Chính" | "Ghép";

export interface TeamConfig {
  id: number;
  name: string;
  tables: number;
}

export interface HolidayItem {
  date: string;
  name: string;
}

export interface PORecord {
  id: string;
  po: string;
  itemCode: string;
  color: string;
  quantity: number;
  frontDm: number;
  backDm: number;
}

export interface JobItem {
  id: string;
  rowId: string;
  po: string;
  itemCode: string;
  color: string;
  role: Role;
  dm: number;
  quantity: number;
  remaining: number;
  assignedTeamId?: number;
  siblingId?: string;
  loadScore: number;
}

export interface PlanRow {
  key: string;
  date: string;
  weekday: string;
  teamId: number;
  teamName: string;
  tables: number;
  type: PlanType;
  po: string;
  itemCode: string;
  color: string;
  role: string;
  dm: number;
  rounds: number;
  minutes: number;
  plannedQty: number;
  remainingStart: number;
  remainingEnd: number;
  jobId: string;
  jobRemainingAfter: number;
}

export interface TeamDaySummary {
  date: string;
  weekday: string;
  teamId: number;
  teamName: string;
  tables: number;
  rows: PlanRow[];
  mainMinutes: number;
  extraMinutes: number;
  totalMinutes: number;
  fillRate: number;
}

export interface ScheduleResult {
  jobs: JobItem[];
  rows: PlanRow[];
  teamDays: TeamDaySummary[];
  byDate: Map<string, TeamDaySummary[]>;
  byTeam: Map<number, PlanRow[]>;
}

export interface AppSettings {
  minutesPerDay: number;
  startDate: string;
  workdays: number[];
  holidays: HolidayItem[];
  teams: TeamConfig[];
}
