import type { TaskStatus } from "./task.model.js";

export type NoteSignalType = "blocked" | "credential" | "operational" | "action" | "transition";
export interface NoteSignal { type: NoteSignalType; text: string; }
export interface AccountOutcomes { good: number; bad: number; notFound: number; total: number; }
export interface TaskProgressInput { title: string; notes?: string | undefined; structuredTarget?: number | undefined; status: TaskStatus; }
export interface TaskProgress { target: number; completed: number; remaining: number; checklistCount: number; normalizedType: string; workflowActual: number; signals: NoteSignal[]; accountOutcomes: AccountOutcomes; blockerSummary?: string | undefined; }

const markers: ReadonlyArray<{ marker: string; type: NoteSignalType }> = [
  { marker: "⛔", type: "blocked" }, { marker: "🔒", type: "credential" }, { marker: "🚩", type: "operational" },
  { marker: "📌", type: "action" }, { marker: "➡️", type: "transition" }
];

export const normalizeTaskType = (title: string): string => {
  const value = title.trim().toLowerCase().replace(/^\d+\s*/, "").replace(/\s+/g, " ");
  if (/^scripts?\b/.test(value)) return "script";
  if (/^emails?\b/.test(value)) return "email";
  if (/^action needed\b/.test(value)) return "action needed check";
  if (/^invitations?\b/.test(value)) return "invitation acceptance";
  if (/^deactivation date check\b/.test(value)) return "deactivation date check";
  if (/^active wm acc\b/.test(value)) return "active wm account";
  if (/\btarget\b/.test(value)) return "target active account";
  return value.replace(/accounts?\b/g, "account");
};

export const parseNoteSignals = (notes = ""): NoteSignal[] => notes.split(/\r?\n/).flatMap((line) => {
  const text = line.trim(); const match = markers.find(({ marker }) => text.includes(marker));
  return text && match ? [{ type: match.type, text }] : [];
});

export const extractCheckedTotal = (notes: string): number => Number(notes.match(/(?:>{2,}\s*)?total\s*:\s*(\d+)\s*acc\s*check+ed|\b(\d+)\s*acc[^\n]*check+ed/i)?.slice(1).find(Boolean) ?? 0);

export const extractWorkflowActual = (normalizedType: string, notes: string, status: TaskStatus): number => {
  const checks = notes.match(/(?:✅|☑️?)/gu)?.length ?? 0;
  if (normalizedType === "invitation acceptance") {
    const stated = [...notes.matchAll(/(\d+)\s*(?:invitation|invitetion|inv)\b/gi)].at(-1)?.[1];
    return stated ? Number(stated) : (notes.match(/Seller Central\s*\(/gi)?.length ?? checks);
  }
  if (normalizedType === "deactivation date check") return extractCheckedTotal(notes) || checks;
  if (normalizedType === "active wm account") {
    const active = notes.match(/(\d+)\s*acc\s+active\s+(?:for\s+wm|now)/i)?.[1] ?? notes.match(/\+\s*(\d+)\s+order[^\n]*acc\s+active\s+now/i)?.[1];
    return Number(active ?? 0);
  }
  if (normalizedType === "target active account") {
    if (checks > 0) return checks;
    if (status === "completed" && !/(?:in progress|delivery|under testing|estimated)/i.test(notes)) return Number(notes.match(/(\d+)\s*acc\b/i)?.[1] ?? 0);
  }
  return 0;
};

export const parseAccountOutcomes = (notes = ""): AccountOutcomes => {
  const result = { good: 0, bad: 0, notFound: 0, total: 0 };
  const lines = notes.split(/\r?\n/);
  const summaryGood = lines.find((line) => /(?:✅\s*)?good\s*-?\s*\d+\s*acc/i.test(line));
  const summaryLocked = lines.find((line) => /account locked temporarily\s*-?\s*\d+\s*acc/i.test(line));
  const summaryCredential = lines.find((line) => /(?:incorrect password|password reset).*?\d+\s*acc/i.test(line));
  const summaryNotFound = lines.find((line) => /account not found\s*-?\s*\d+\s*acc/i.test(line));
  const amount = (line: string | undefined) => Number(line?.match(/(\d+)\s*acc/i)?.[1] ?? 0);
  result.good += amount(summaryGood); result.bad += amount(summaryLocked) + amount(summaryCredential); result.notFound += amount(summaryNotFound);

  const checkedTotal = extractCheckedTotal(notes);
  const identityLines = lines.filter((line) => /[\w.+-]+@[\w.-]+|\+\d{7,}/.test(line));
  const linesToClassify = !summaryGood && !summaryLocked && !summaryCredential && !summaryNotFound && checkedTotal > 0 ? identityLines.slice(-checkedTotal) : lines;
  for (const line of linesToClassify) {
    const hasIdentity = /[\w.+-]+@[\w.-]+|\+\d{7,}/.test(line);
    if (!hasIdentity) continue;
    if (line.includes("➡️")) result.good += 1;
    else if ((line.includes("✅") && !summaryGood) || /☑️?/.test(line)) result.good += 1;
    else if ((line.includes("⛔") && !summaryLocked) || (line.includes("🔒") && !summaryCredential)) result.bad += 1;
    else if (line.includes("🚩") && !summaryNotFound) result.notFound += 1;
  }
  result.total = result.good + result.bad + result.notFound;
  return result;
};

export const calculateTaskProgress = ({ title, notes = "", structuredTarget, status }: TaskProgressInput): TaskProgress => {
  const titleTarget = title.match(/\d+/)?.[0];
  const checkedTotal = /action needed/i.test(title) ? extractCheckedTotal(notes) : 0;
  const target = checkedTotal || (structuredTarget !== undefined && structuredTarget >= 0 ? structuredTarget : titleTarget ? Number(titleTarget) : 1);
  const checklistCount = notes.match(/(?:✅|☑️?)/gu)?.length ?? 0;
  const completed = checkedTotal || (checklistCount > 0 ? Math.min(checklistCount, target) : status === "completed" ? target : 0);
  const signals = parseNoteSignals(notes);
  const accountOutcomes = parseAccountOutcomes(notes);
  const normalizedType = normalizeTaskType(title);
  const workflowActual = extractWorkflowActual(normalizedType, notes, status);
  const reasons = signals.filter(({ type }) => type === "blocked" || type === "credential" || type === "operational");
  return { target, completed, remaining: Math.max(target - completed, 0), checklistCount, normalizedType, workflowActual, signals, accountOutcomes, blockerSummary: reasons.length ? reasons.map(({ text }) => text).join("\n") : undefined };
};

export const resolveDayBucketDate = (bucket: string, weekStart: Date): Date | undefined => {
  const match = bucket.trim().toUpperCase().match(/^P(\d+)$/); if (!match) return undefined;
  const result = new Date(weekStart); result.setUTCDate(result.getUTCDate() + Number(match[1])); return result;
};
