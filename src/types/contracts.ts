export type TaskStatus = "not-started" | "in-progress" | "completed" | "blocked";

export interface OverviewMetric { completed: number; target: number; }
export interface OverviewMetricDetail { id: string; task: string; owner: string; weekday: string; target: number; completed: number; remaining: number; status: TaskStatus; reason: string; noteQuantity?: boolean; accountOutcomes?: { good: number; bad: number; notFound: number; total: number }; }
export interface AttentionItem { id: string; kind: "task" | "account" | "issue"; title: string; detail: string; }
export interface RecentIssue {
  id: string; title: string; severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved"; createdAt: string;
}
export interface OverviewResponse {
  week: { id: string; label: string; start: string; end: string } | null;
  output: { scripts: OverviewMetric; emails: OverviewMetric; actionNeeded: OverviewMetric; invitationAcceptance: OverviewMetric; deactivationCheck: OverviewMetric; activeWmAccount: OverviewMetric; targetActiveAccount: OverviewMetric; accounts: OverviewMetric };
  metricDetails: { scripts: OverviewMetricDetail[]; emails: OverviewMetricDetail[]; actionNeeded: OverviewMetricDetail[]; invitationAcceptance: OverviewMetricDetail[]; deactivationCheck: OverviewMetricDetail[]; activeWmAccount: OverviewMetricDetail[]; targetActiveAccount: OverviewMetricDetail[]; accounts: OverviewMetricDetail[] };
  accountOutcomes: { good: number; bad: number; notFound: number; total: number };
  actionBreakdown: { good: number; bad: number; pending: number; total: number };
  taskStatus: Record<TaskStatus, number>;
  budget: { budget: number; spent: number; balance: number; currency: string };
  attention: AttentionItem[];
  recentIssues: RecentIssue[];
  weeklyKpis: { required: number; completed: number; remaining: number; completionRate: number };
  targetVsActual: Array<{ taskType: string; target: number; completed: number; remaining: number }>;
  ownerPerformance: Array<{ owner: string; target: number; completed: number; remaining: number; completionRate: number }>;
  incompleteWork: Array<{ id: string; task: string; owner: string; weekday: string; target: number; completed: number; remaining: number; reason: string }>;
  systemBlockers: Array<{ task: string; owner: string; type: "blocked" | "credential" | "operational"; reason: string }>;
}

