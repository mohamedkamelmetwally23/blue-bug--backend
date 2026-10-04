import type { OverviewResponse, TaskStatus } from "../../types/contracts.js";
import { AccountModel } from "../accounts/account.model.js";
import { ExpenseModel } from "../expenses/expense.model.js";
import { IssueModel } from "../issues/issue.model.js";
import { TaskEntryModel } from "../task-entries/task-entry.model.js";
import { TaskModel, type TaskKind } from "../tasks/task.model.js";
import { WeekModel } from "../weeks/week.model.js";

export const getOverview = async (requestedWeekId?: string): Promise<OverviewResponse> => {
  const week = requestedWeekId
    ? await WeekModel.findOne({ weekId: requestedWeekId })
    : await WeekModel.findOne({ isActive: true }).sort({ start: -1 });

  if (!week) return emptyOverview();
  const weekId = week.weekId;

  const [taskGroups, activeAccounts, expenses, issues, blockedTasks, blockedAccounts, tasks, entries] = await Promise.all([
    TaskModel.aggregate<{ _id: TaskStatus; count: number }>([
      { $match: { weekId } }, { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    AccountModel.countDocuments({ weekId, lifecycleStatus: "active", activationStatus: "active" }),
    ExpenseModel.aggregate<{ total: number }>([{ $match: { weekId } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    IssueModel.find({ weekId }).sort({ createdAt: -1 }).limit(5),
    TaskModel.find({ weekId, status: "blocked" }).limit(4),
    AccountModel.find({ weekId, blockers: { $exists: true, $ne: "" } }).limit(4),
    TaskModel.find({ weekId }), TaskEntryModel.find({ weekId })
  ]);

  const status: Record<TaskStatus, number> = { "not-started": 0, "in-progress": 0, completed: 0, blocked: 0 };
  for (const group of taskGroups) status[group._id] = group.count;
  const completedFor = (kind: TaskKind): number =>
    taskFacts.filter(({ task }) => task.kind === kind).reduce((sum, { completed: value }) => sum + value, 0);
  const spent = expenses[0]?.total ?? 0;
  const completedByTask = new Map<string, number>();
  for (const entry of entries) completedByTask.set(entry.taskId.toString(), (completedByTask.get(entry.taskId.toString()) ?? 0) + entry.completed);
  const taskFacts = tasks.map((task) => {
    const recordedCompleted = completedByTask.get(task.id) ?? 0;
    const taskCompleted = task.source === "google-sheets"
      ? Math.min(task.completed ?? recordedCompleted, task.target)
      : Math.min(recordedCompleted, task.target);
    return { task, completed: taskCompleted, remaining: Math.max(task.target - taskCompleted, 0) };
  });
  const typeMap = new Map<string, { target: number; completed: number; remaining: number }>();
  const ownerMap = new Map<string, { target: number; completed: number; remaining: number }>();
  for (const fact of taskFacts) {
    const type = fact.task.normalizedType || fact.task.title.toLowerCase(); const typeTotals = typeMap.get(type) ?? { target: 0, completed: 0, remaining: 0 };
    typeTotals.target += fact.task.target; typeTotals.completed += fact.completed; typeTotals.remaining += fact.remaining; typeMap.set(type, typeTotals);
    const owner = fact.task.owner ?? "Unassigned"; const ownerTotals = ownerMap.get(owner) ?? { target: 0, completed: 0, remaining: 0 };
    ownerTotals.target += fact.task.target; ownerTotals.completed += fact.completed; ownerTotals.remaining += fact.remaining; ownerMap.set(owner, ownerTotals);
  }
  const required = taskFacts.reduce((sum, fact) => sum + fact.task.target, 0);
  const completed = taskFacts.reduce((sum, fact) => sum + fact.completed, 0);
  const detailForFacts = (facts: typeof taskFacts) => facts.map(({ task, completed: taskCompleted, remaining }) => ({
    id: task.id, task: task.title, owner: task.owner ?? "Unassigned",
    weekday: task.dayDate?.toLocaleDateString("en", { weekday: "long", timeZone: "UTC" }) ?? task.dayBucket ?? "—",
    target: task.target, completed: taskCompleted, remaining, status: task.status,
    reason: task.blockerSummary ?? (remaining > 0 ? task.notes?.split(/\r?\n/).find(Boolean) ?? "No reason provided" : "Completed"),
    clarifications: task.notes ?? "",
    accountOutcomes: task.accountOutcomes
  }));
  const detailFor = (kinds: TaskKind[]) => detailForFacts(taskFacts.filter(({ task }) => kinds.includes(task.kind)));
  const metricFor = (kind: TaskKind) => {
    const facts = taskFacts.filter(({ task }) => task.kind === kind);
    return { completed: facts.reduce((sum, fact) => sum + fact.completed, 0), target: facts.reduce((sum, fact) => sum + fact.task.target, 0) };
  };
  const emailFacts = tasks
    .filter((task) => task.normalizedType === "email")
    .map((task) => {
      const taskCompleted = task.source === "google-sheets" ? task.completed ?? completedByTask.get(task.id) ?? 0 : completedByTask.get(task.id) ?? 0;
      return { task, completed: taskCompleted, remaining: Math.max(task.target - taskCompleted, 0) };
    });
  const factsForType = (normalizedType: string) => taskFacts.filter(({ task }) => task.normalizedType === normalizedType);
  const metricForType = (normalizedType: string) => {
    const facts = factsForType(normalizedType);
    const actual = facts.reduce((sum, fact) => sum + (fact.task.workflowActual ?? 0), 0);
    return { completed: actual, target: actual };
  };
  const detailsForType = (normalizedType: string) => {
    const grouped = new Map<string, typeof taskFacts>();
    for (const fact of factsForType(normalizedType)) {
      const key = fact.task.dayDate?.toISOString().slice(0, 10) ?? fact.task.dayBucket ?? fact.task.id;
      grouped.set(key, [...(grouped.get(key) ?? []), fact]);
    }
    return [...grouped.entries()].map(([key, facts]) => {
      const first = facts[0]!;
      const actual = facts.reduce((sum, { task }) => sum + (task.workflowActual ?? 0), 0);
      const statuses = facts.map(({ task }) => task.status);
      const status = statuses.every((value) => value === "completed") ? "completed" as const : statuses.includes("blocked") ? "blocked" as const : statuses.includes("in-progress") ? "in-progress" as const : "not-started" as const;
      return {
        id: `${normalizedType}-${key}`, task: first.task.title,
        owner: [...new Set(facts.map(({ task }) => task.owner ?? "Unassigned"))].join(", "),
        weekday: first.task.dayDate?.toLocaleDateString("en", { weekday: "long", timeZone: "UTC" }) ?? first.task.dayBucket ?? "—",
        target: actual, completed: actual, remaining: 0, status,
        reason: facts.map(({ task }) => task.notes).filter((notes): notes is string => Boolean(notes)).join("\n\n") || "No notes provided",
        clarifications: facts.map(({ task }) => task.notes).filter((notes): notes is string => Boolean(notes)).join("\n\n"),
        noteQuantity: true
      };
    });
  };
  const accountKinds: TaskKind[] = ["action-check"];
  const accountOutcomes = taskFacts.filter(({ task }) => accountKinds.includes(task.kind)).reduce((totals, { task }) => ({
    good: totals.good + (task.accountOutcomes?.good ?? 0), bad: totals.bad + (task.accountOutcomes?.bad ?? 0),
    notFound: totals.notFound + (task.accountOutcomes?.notFound ?? 0), total: totals.total + (task.accountOutcomes?.total ?? 0)
  }), { good: 0, bad: 0, notFound: 0, total: 0 });
  const actionBreakdown = taskFacts.filter(({ task }) => task.kind === "action-check").reduce((totals, { task, completed: checksCompleted, remaining }) => {
    const good = task.accountOutcomes?.good ?? 0;
    const bad = (task.accountOutcomes?.bad ?? 0) + (task.accountOutcomes?.notFound ?? 0);
    return { good: totals.good + good, bad: totals.bad + bad, pending: totals.pending + remaining, total: totals.total + checksCompleted };
  }, { good: 0, bad: 0, pending: 0, total: 0 });

  return {
    week: { id: week.weekId, label: week.label, start: week.start.toISOString(), end: week.end.toISOString() },
    output: {
      scripts: { completed: completedFor("script"), target: week.targets.scripts },
      emails: {
        completed: emailFacts.reduce((sum, fact) => sum + fact.completed, 0),
        target: emailFacts.reduce((sum, fact) => sum + fact.task.target, 0)
      },
      actionNeeded: metricFor("action-check"),
      invitationAcceptance: metricForType("invitation acceptance"),
      deactivationCheck: metricForType("deactivation date check"),
      activeWmAccount: metricForType("active wm account"),
      targetActiveAccount: metricForType("target active account"),
      accounts: { completed: accountOutcomes.total, target: accountOutcomes.total }
    },
    accountOutcomes,
    actionBreakdown,
    metricDetails: { scripts: detailFor(["script"]), emails: detailForFacts(emailFacts), actionNeeded: detailFor(["action-check"]), invitationAcceptance: detailsForType("invitation acceptance"), deactivationCheck: detailsForType("deactivation date check"), activeWmAccount: detailsForType("active wm account"), targetActiveAccount: detailsForType("target active account"), accounts: detailFor(["action-check"]) },
    taskStatus: status,
    budget: { budget: week.budget, spent, balance: week.budget - spent, currency: week.currency },
    attention: [
      ...blockedTasks.map((task) => ({ id: task.id, kind: "task" as const, title: task.title, detail: task.notes ?? "Task is blocked" })),
      ...blockedAccounts.map((account) => ({ id: account.id, kind: "account" as const, title: account.name, detail: account.blockers ?? "Account needs attention" })),
      ...issues.filter((issue) => issue.severity === "critical").map((issue) => ({ id: issue.id, kind: "issue" as const, title: issue.title, detail: issue.description ?? "Critical issue" }))
    ].slice(0, 8),
    recentIssues: issues.map((issue) => ({ id: issue.id, title: issue.title, severity: issue.severity, status: issue.status, createdAt: issue.createdAt.toISOString() })),
    weeklyKpis: { required, completed, remaining: Math.max(required - completed, 0), completionRate: required ? Math.round(completed / required * 100) : 0 },
    targetVsActual: [...typeMap.entries()].map(([taskType, totals]) => ({ taskType, ...totals })).sort((a, b) => b.target - a.target),
    ownerPerformance: [...ownerMap.entries()].map(([owner, totals]) => ({ owner, ...totals, completionRate: totals.target ? Math.round(totals.completed / totals.target * 100) : 0 })).sort((a, b) => b.completionRate - a.completionRate),
    incompleteWork: taskFacts.filter((fact) => fact.remaining > 0).map(({ task, completed, remaining }) => ({ id: task.id, task: task.title, owner: task.owner ?? "Unassigned", weekday: task.dayDate?.toLocaleDateString("en", { weekday: "long", timeZone: "UTC" }) ?? task.dayBucket ?? "—", target: task.target, completed, remaining, reason: task.blockerSummary ?? task.notes?.split(/\r?\n/).find(Boolean) ?? "No reason provided" })),
    systemBlockers: tasks.flatMap((task) => task.signals.filter((signal) => signal.type === "blocked" || signal.type === "credential" || signal.type === "operational").map((signal) => ({ task: task.title, owner: task.owner ?? "Unassigned", type: signal.type as "blocked" | "credential" | "operational", reason: signal.text })))
  };
};

const emptyOverview = (): OverviewResponse => ({
  week: null,
  output: { scripts: { completed: 0, target: 0 }, emails: { completed: 0, target: 0 }, actionNeeded: { completed: 0, target: 0 }, invitationAcceptance: { completed: 0, target: 0 }, deactivationCheck: { completed: 0, target: 0 }, activeWmAccount: { completed: 0, target: 0 }, targetActiveAccount: { completed: 0, target: 0 }, accounts: { completed: 0, target: 0 } },
  metricDetails: { scripts: [], emails: [], actionNeeded: [], invitationAcceptance: [], deactivationCheck: [], activeWmAccount: [], targetActiveAccount: [], accounts: [] },
  accountOutcomes: { good: 0, bad: 0, notFound: 0, total: 0 },
  actionBreakdown: { good: 0, bad: 0, pending: 0, total: 0 },
  taskStatus: { "not-started": 0, "in-progress": 0, completed: 0, blocked: 0 },
  budget: { budget: 0, spent: 0, balance: 0, currency: "USD" }, attention: [], recentIssues: [],
  weeklyKpis: { required: 0, completed: 0, remaining: 0, completionRate: 0 }, targetVsActual: [], ownerPerformance: [], incompleteWork: [], systemBlockers: []
});
