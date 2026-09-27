const aliases: Readonly<Record<string, string>> = {
  "record id": "recordId", recordid: "recordId", "week id": "weekId", weekid: "weekId",
  "entity type": "entityType", entitytype: "entityType", task: "task", priority: "priority", owner: "owner",
  status: "status", "start date": "startDate", "end date": "endDate", deliverable: "deliverable", notes: "notes",
  kind: "kind", target: "target", name: "name", country: "country", provider: "provider", email: "email",
  "lifecycle status": "lifecycleStatus", "invitation status": "invitationStatus", "activation status": "activationStatus",
  "deactivation date": "deactivationDate", blockers: "blockers", "last checked": "lastChecked", title: "title",
  description: "description", category: "category", severity: "severity", "issue status": "issueStatus",
  amount: "amount", currency: "currency", "spent at": "spentAt"
};

export const normalizeRow = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [aliases[key.trim().toLowerCase()] ?? key, value]));

export const rowsFromValues = (values: unknown[][]): Record<string, unknown>[] => {
  const header = (values[0] ?? []).map(String);
  return values.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== "")).map((row) =>
    Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""]))
  );
};

