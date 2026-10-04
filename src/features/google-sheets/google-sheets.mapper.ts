const aliases: Readonly<Record<string, string>> = {
  "record id": "recordId", recordid: "recordId", "week id": "weekId", weekid: "weekId",
  "entity type": "entityType", entitytype: "entityType", task: "task", priority: "priority", owner: "owner",
  day: "priority", status: "status", "start date": "startDate", "end date": "endDate", deliverable: "deliverable",
  notes: "notes", clarifications: "notes", "names of acc": "accountNames", "names of accounts": "accountNames",
  num: "target", done: "completed", "num done": "completed",
  kind: "kind", target: "target", name: "name", country: "country", provider: "provider", email: "email",
  "lifecycle status": "lifecycleStatus", "invitation status": "invitationStatus", "activation status": "activationStatus",
  "deactivation date": "deactivationDate", blockers: "blockers", "last checked": "lastChecked", title: "title",
  description: "description", category: "category", severity: "severity", "issue status": "issueStatus",
  amount: "amount", currency: "currency", "spent at": "spentAt"
};

export const normalizeRow = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [aliases[key.trim().toLowerCase()] ?? key, value]));

export const rowsFromValues = (values: unknown[][]): Record<string, unknown>[] => {
  const headerIndex = values.findIndex((row) => {
    const headers = row.map((cell) => String(cell).trim().toLowerCase());
    return headers.includes("task") && headers.includes("start date") && headers.includes("end date");
  });
  const startIndex = headerIndex < 0 ? 0 : headerIndex;
  const header = (values[startIndex] ?? []).map(String);
  return values.slice(startIndex + 1).filter((row) => row.some((cell) => String(cell).trim() !== "")).map((row) =>
    Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""]))
  );
};
