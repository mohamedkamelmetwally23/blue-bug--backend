# Blue Bug operations rebuild

## Architecture and source

React 19/Vite frontend and stateless Express 5/Node 22 TypeScript backend remain separate Git repositories. Each becomes its own Vercel project. No deployment, push or merge is performed by this rebuild.

```
backend/
  src/app.ts                 Express serverless export
  src/server.ts              local listener only
  src/config/                validated environment, reused Mongo connection
  src/modules/
    models.ts                16 fresh collections and query indexes
    domain.ts                dates, validation, business errors
    auth.ts                  salted scrypt passwords, signed expiring sessions
    repository.ts            team scope, roles, transactions, audit
    planning.ts              categories, plans, assignments, permissions
    operations.ts            entry, corrections, submission, review, finalization
    reports.ts               canonical aggregation and snapshot retrieval
    exports.ts               Excel/PDF using report calculations
    notifications.ts         durable email outbox and leases
    routes.ts                validated API adapters
  scripts/                   schema initialization, provisioning, safe cleanup stub
  tests/                     unit and disposable replica-set API integration tests
  docs/                      this report and deployment instructions
frontend/
  src/app/App.tsx            authentication, accessible navigation, team/week selection
  src/workspace/             role screens, API hooks and shared form controls
  src/styles.css             shared original brand tokens and responsive layout
  brand-reference.css        preserved original theme evidence
```

Brand: existing Blue Bug wordmark and Lucide Bug mark retained. Original current screen colors: #102f50 navigation, #214566 active navigation, #087bc1 primary, #55b7ed accent, #172b42 ink, #f5f7fb background, #e3e9f1 borders. No replacement logo was created. The original repository contains no separate raster/vector logo files.

## Database boundary

The existing Atlas cluster is reused with **ops_dev_blue_bug_v2**, a NEW isolated database. Legacy collections are untouched and no legacy data migration is implemented. The old local environment file is preserved as ignored `.env.legacy`. Runtime requires a database name matching `ops_(dev|preview|test|production)...`; it cannot silently fall back to the legacy database.

Collections: auth_login_limits, users, teams, team_memberships, task_categories, category_requests, weekly_plans, task_assignments, operations, daily_submissions, late_permissions, approval_events, weekly_report_snapshots, notifications, notification_preferences, audit_logs.

All have timestamps and strict schemas. References use ObjectIds. Dynamic field definitions and results are snapshotted on operations; category edits increment a version. Operations have a client request UUID unique per employee. Review revisions prevent stale writes. Transactions touch the weekly plan for every operation/assignment change; finalization shares the lock document and writes a consistent snapshot. MongoDB transaction retries handle transient write conflicts. Atlas replica sets support transactions; standalone local MongoDB is unsupported.

Login attempts are capped at 20 per normalized account per 15-minute window using a durable hashed counter and TTL expiry.

Indexes in models.ts match API queries: unique login-window key and TTL expiration; unique user email; unique team/user membership and reverse membership lookup; team/active category lookup; unique team/week plan; plan/employee assignments; unique employee/request operation key; team/date/status, employee/date, assignment/status and team/week/status operations; unique employee/day submission; unique team/employee/week permission; unique operation/revision approval event; unique team/week snapshot; unique user/event notification; user/created notification and outbox state/lease; unique user preference; team/created audit.

No unbounded arrays are embedded in team or user documents. Category fields/results are request-bounded. List endpoints paginate or enforce documented caps (teams 100, members 500, categories 200, notification center 100). Reports aggregate on indexed ranges, bounded to one year; grouped reporting output can still grow with employee/category cardinality and should be measured on production-sized data.

## Workflows and calculations

Managers see operational data read-only. Coordinators manage only membership-scoped teams. Employees can query/update only their own operations and assignments. All roles can edit personal notification settings.

Workdays are Monday–Friday using Africa/Cairo calendar dates. Previous workdays can be amended through Friday; after Friday an unexpired coordinator permission is required. Future work and weekends are rejected. Approved operations and finalized weeks are locked. Returned corrections retain original definitions, become drafts, and are resubmitted by Submit Day. Submit Day updates drafts only, preserving unrelated approvals. An empty/repeated Submit Day submits zero operations.

Productivity is the number of approved operations, including Good, Pending, Bad and all configured labels. Approved quantity is a separate metric. Targets are operation counts; a quantity operation counts once toward the operation target and its quantity is shown separately. Daily targets multiply by intersecting workdays; weekly targets are allocated proportionally over five workdays when a month clips a week. No-target assignments contribute zero. Month reports filter exact dates, avoiding overlap/double counting. Full-team finalized weekly requests retrieve the locked snapshot. Personal, monthly and multi-team reports derive from immutable finalized operation records and locked assignment targets.

Finalization is manual after Friday and refuses any draft, submitted or returned operation. After finalization no plan, target or operation edits are accepted. Reports, dashboards and exports all use reports.ts.

## APIs

Base `/api/v1`; JSON success `{data,...pagination}`; errors `{error:{message,issues?}}`. Bearer session required except login and health. Dates are ISO `YYYY-MM-DD`; IDs are Mongo ObjectIds. Mutations enforce roles on the server.

- GET health; POST auth/login; GET auth/me; POST auth/logout (revokes all current user sessions).
- GET teams; GET teams/:teamId/members.
- GET/POST teams/:teamId/categories; PATCH categories/:id under the same team prefix.
- GET/POST teams/:teamId/plans.
- GET/POST teams/:teamId/assignments; PATCH assignments/:id (revision required).
- GET/POST teams/:teamId/operations; PATCH operations/:id (revision required).
- POST teams/:teamId/submit-day `{workDate}`.
- POST teams/:teamId/operations/:id/review `{revision,action:approved|returned,reason}`.
- GET/POST teams/:teamId/late-permissions `{employeeId,weekStart,expiresAt}`.
- POST teams/:teamId/finalize `{weekStart}`.
- GET teams/:teamId/submissions.
- GET/POST teams/:teamId/category-requests; PATCH category-requests/:id `{status:accepted|declined}`. Acceptance is a recorded decision; coordinator configures the new category separately.
- GET teams/:teamId/audit.
- GET reports and exports/:xlsx|pdf with `start,end,teamId?,employeeId?`.
- GET notifications; PATCH notifications/:id (mark read).
- GET/PUT preferences `{inApp,email,kinds}`.
- POST internal/deliver with separate `CRON_SECRET` bearer credential.

List pagination: `page` (1–10000), `limit` (1–100, default 30). Operation filters: status, date, weekStart, employeeId. Assignments filter by planId. Reports without a team filter use all authorized teams; employees are always restricted to their own records.

## Removal inventory

Replaced old backend `src/features`, `src/core`, `src/types` implementations, the Google Apps Script sync, and three legacy tests. Replaced old frontend `src/features`, `src/components`, `src/lib`, `src/types`, App and stylesheet. Removed googleapis. No legacy routes, spreadsheet sync, budget/expense calculations or competing productivity calculation remain active. Git retains the original files. See each repository's `git diff --stat` for the exact file inventory. Legacy compiled output in ignored dist folders is replaced by a clean build and is not deployed from source.

## Environment

Backend: MONGODB_URI, MONGODB_DB_NAME, AUTH_SECRET (32+ random characters), FRONTEND_URL, NODE_ENV, PORT. Optional EMAIL_API_URL, EMAIL_API_KEY, EMAIL_FROM, CRON_SECRET. Frontend: VITE_API_BASE_URL including `/api/v1`. Never put credentials in a VITE variable.

No email provider was configured in the old application. Delivery remains disabled until an approved HTTP provider is configured. The provider must accept the documented from/to/subject/text JSON and honor Idempotency-Key. Preferences default to in-app on, email off. Notifications persist independently of delivery. A scheduler calls internal/deliver; no in-process background worker exists. Leases reclaim interrupted sends; stable provider keys suppress duplicate emails. Inspect failed outbox records after five attempts. Provider key retention must exceed the retry window; do not use a provider with weaker idempotency guarantees without adapting this integration.

## Database safety / cleanup

`npm run db:init` creates fresh named database collections/indexes; it never drops indexes or collections and refuses databases containing unknown collections. `npm run db:cleanup:dry-run` prints source candidates without connecting. Its `--execute` mode always refuses. Do not run either provisioning or initialization during Vercel builds.

Deletion of the old database is explicitly out of scope and requires a separate review. Before any future deletion, inventory the exact database/collections and ownership, obtain explicit approval, use mongodump to a protected encrypted backup, record checksums, restore with mongorestore into a different isolated verification database, compare collection counts and indexes and exercise representative read workflows. No backup or restore of legacy data is necessary for this non-destructive fresh-schema rebuild, and none was claimed to have been performed. Keep old data intact until those steps pass.
