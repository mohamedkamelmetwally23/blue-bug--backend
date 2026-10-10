# Blue Bug Operations ? current implementation

## Shared workspace

Teams were removed at the user's request on 10 October 2026. There are no team schemas, memberships, selectors, team references, or team-specific endpoints. All authenticated accounts share categories. Managers and Coordinators see all work and employees. Employees retain access to their own assigned tasks and historical entries; they cannot mutate other employees' tasks. Only Coordinators create/edit/delete categories and create/edit/assign tasks. Managers remain read-only.

## Preserved data

The guarded migration ran only against Atlas development database ops_dev_blue_bug_v2. Deleted collections: teams, team_memberships. Removed team references, snapshot references, and indexes containing teamId. Credentials and all remaining business content were compared before/after with hashes after excluding the intentionally removed team references. All were preserved: users 3, categories 8, tasks 0, task_entries 0. These are migration-time counts; users may subsequently create more work. No business data reset or seed was performed.

Evidence: [remove-teams-result.json](remove-teams-result.json). Current schemas are users, categories, tasks, task_entries. The old reset command was removed; application startup/build never run migrations.

## Pages

| Role | Route | Page |
| --- | --- | --- |
| Employee | /employee/tasks | My Tasks |
| Employee | /employee/activity | My Activity |
| Manager | /manager/overview | Overview |
| Manager | /manager/employees | Employees |
| Coordinator | /coordinator/tasks | Tasks |
| Coordinator | /coordinator/categories | Categories |
| Coordinator | /coordinator/employees | Employees |
| Coordinator | /coordinator/monthly-financial-report | Monthly Financial Report ? Coming Soon |

Create/edit category popup contains only name and description. Existing category configuration is preserved when updating these fields. Cards show name, description, active state, Edit, and Delete. Delete requires a confirmation popup and is rejected when a category is linked to tasks. Financial reporting has no form or persistence.

## API

Prefix /api/v1. Success envelope {data: value}; errors {error: {message, issues?}}. JWT authentication is required except health/login. Task and entry lists return {items,total,page,limit}; maximum limit 100.

| Method | Path | Access |
| --- | --- | --- |
| GET | /health | Public |
| POST | /auth/login | Public; {email,password} ? {token,user} |
| GET | /auth/me | Authenticated |
| POST | /auth/logout | Authenticated; revoke sessions |
| GET | /categories | Authenticated; all categories |
| POST | /categories | Coordinator |
| PUT | /categories/:id | Coordinator |
| DELETE | /categories/:id | Coordinator; rejects linked categories |
| GET | /tasks | Management sees all; Employee sees own assignments |
| POST | /tasks | Coordinator |
| PUT | /tasks/:id | Coordinator |
| DELETE | /tasks/:id | Coordinator; untouched tasks only |
| PATCH | /tasks/:id/progress | Assigned Employee |
| GET | /tasks/:id/entries | Management, assigned Employee, or previous contributor's own entries |
| POST | /tasks/:id/entries | Assigned Employee |
| PUT | /tasks/:id/entries/:entryId | Assigned Employee |
| DELETE | /tasks/:id/entries/:entryId | Assigned Employee |
| GET | /overview | Manager/Coordinator |
| GET | /employees | Manager/Coordinator; all employee accounts |

Task payload: {categoryId,assignedEmployee,title,instructions?,workDate,target?}. Progress: {status?,notes?,aggregateQuantity?}. Entry: {identifier,result?,values?,notes?}. Task filters: categoryId, employeeId (management), day, from, to, status, page, limit. Employee history=true includes prior contributed tasks after reassignment. Legacy /teams routes return 404.

Categories retain backend field/result configuration for existing work: {name,description?,mode?,targetBehavior?,results?,fields?,active?}. New simple categories default to individual-entry counts, optional targets, no dynamic fields/results. Task category schema is frozen; subsequent category edits do not change existing tasks. Status is explicitly controlled by Employee: Not Started, In Progress, Completed. Counts never automatically complete tasks.

## Source and validation

Backend: auth, categories, tasks, task-entries, manager feature services; models.ts contains the four schemas; routes.ts contains transport handling; shared/permissions contains role checks. Frontend: App.tsx owns authentication/navigation; Tasks.tsx lists work; Forms.tsx owns forms and deletion confirmation; Insights.tsx renders summaries and employees; shared.tsx provides modal/form/data primitives. Centered native dialogs support keyboard focus and mobile sizing. Original branding is retained.

Validation uses disposable MongoDB processes with users that have no memberships. It covers shared category/employee availability, task assignment, entries, counting, explicit completion, category deletion, read-only Manager access, employee assignment boundaries, reassignment history, filters/pagination, login/logout, and absence of team collections. Live credentials were preserved; plaintext-password sign-in for Atlas accounts was not executed. No GitHub push or deployment was performed.

## Weekly financial reports
The coordinator Financial Reports page replaces the monthly placeholder with an editable Monday?Sunday report. The existing URL remains compatible. Each week stores required and achieved account counts, received funds, current cash balance, reserved funds, and budget notes. Remaining accounts are calculated in the UI (minimum zero). Monetary values are stored as integer USD cents. GET /api/v1/financial-reports/:week is available to management; PUT is coordinator-only. Employees cannot read or write financial reports. The weekly_financial_reports collection has a unique weekStart index; previous work records are preserved.
Validation: 24 backend tests, 6 frontend tests, typecheck/lint/build, and isolated browser checks for save, week separation, reload persistence, and mobile layout.

## Minimal task assignments and employee table work
New task creation uses Category, Assigned to, Start date, and optional Additional information. The API derives the display title from the category when omitted and marks the task workFormat=sheet. Employee work fields start blank: Day, Status, End date, Names of acc, Num Done, staus (free text), and Clarifications. The latest request delegates remaining fields to the employee, including End date. Category, Owner, and Start date remain coordinator-controlled. Legacy tasks retain their existing work entry workflow and data. Sheet tasks use a nullable Num Done for quantities (stored separately from legacy aggregate counts); reports and employee summaries include it once, and individual entries cannot be added to sheet tasks. Only the assigned employee can update sheet work. End date cannot precede Start date. Deletion is blocked when employee work exists.
Validation: 25 backend tests and 6 frontend tests pass; browser checks cover the four-field assignment form, empty employee cells, employee save, management read-only review, reload persistence, and mobile scrolling.
