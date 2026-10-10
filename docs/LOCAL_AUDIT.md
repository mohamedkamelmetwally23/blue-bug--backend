# Local end-to-end audit — 2026-10-10

This report supersedes the browser and development-data limitations in `VALIDATION.md`. No Git push, deployment, legacy migration, database deletion, or production write was performed. The existing Blue Bug layout and branding were preserved.

## Environment and evidence

The actual Express API ran on localhost:4000 and Vite on localhost:5173. Real MongoDB Atlas operations used only `ops_dev_blue_bug_v2` on the existing cluster. Installed Google Chrome ran through Playwright, with Africa/Cairo timezone. Browser API traffic was restricted to the local backend.

The repeatable scripts are `scripts/local-api-audit.ts`, `scripts/local-edge-audit.ts`, and `../frontend/scripts/local-browser-audit.mjs`. API scripts refuse to run outside development or against another database. Each primary run creates a uniquely named development team, a second isolated team, and random-password manager/coordinator/employee/peer/outsider accounts with `example.invalid` email addresses. Business writes then go through real application APIs. Synthetic data is retained for inspection; it is not migrated legacy data.

Local evidence is intentionally ignored by Git:

- `backend/.local-audit/api-results.json`: actual statuses, sanitized response bodies, collection/index inventory.
- `backend/.local-audit/edge-results.json`: additional statuses, query execution plan, warm connection reuse and reconnection.
- `frontend/.local-audit/browser-results.json`: rendered UI checks, request statuses, console/runtime errors and aborted requests.
- Both `.local-audit/` directories contain generated exports; the frontend directory also contains responsive screenshots and earlier failure evidence.
- `backend/.local-audit/fixture.json` contains development credentials. Keep it private and ignored. Do not attach it to a PR.

## Database results

PASS: Atlas connection, exact 16-collection inventory, all declared compound/unique/TTL index definitions, and actual CRUD through the application. There are 40 indexes including `_id` indexes:

| Collection | Indexes |
| --- | ---: |
| auth_login_limits | 3 |
| users | 2 |
| teams | 1 |
| team_memberships | 3 |
| task_categories | 2 |
| category_requests | 2 |
| weekly_plans | 2 |
| task_assignments | 3 |
| operations | 6 |
| daily_submissions | 2 |
| late_permissions | 2 |
| approval_events | 2 |
| weekly_report_snapshots | 2 |
| notifications | 4 |
| notification_preferences | 2 |
| audit_logs | 2 |

Ten concurrent connection calls reused the same actual Atlas client. Closing the driver and reconnecting restored a live connection to the same development database. An actual operations team/date/status query used an index scan, examining 10 keys and 10 documents for 10 results.

All audit connections and writes were scoped to the new database; no legacy or production database was opened by an audit script. Independent before/after checksums of legacy/production databases are **NOT TESTED**, because those databases were deliberately not accessed. Atlas credential privileges and cluster network rules were not changed or independently certified.

## Executed API results

The primary suite passed **77 checks** on the latest fresh fixture, `local-audit-2026-10-10T13-51-00-093Z`. The supplemental suite passed **37 checks** on an earlier fixture, `local-audit-2026-10-10T13-40-43-512Z`. Four additional compiled-backend smoke requests passed in local production runtime mode, still using the isolated development database: health 200, unauthenticated session 401, manager login 200, reports 200.

All paths below are under `/api/v1`; `T` means the synthetic team ID.

| Executed request/scenario | Actual HTTP status |
| --- | --- |
| GET /health | 200 |
| POST /auth/login; GET /auth/me for all five accounts | 200 |
| Missing credentials, wrong password, expired token, logged-out token | 401 |
| Cross-team reads/writes; manager plan write; employee category write | 403 |
| POST /teams/T/plans, /categories, /assignments | 201 |
| GET employee assignments/operations, with peer isolation assertions | 200 |
| Invalid dynamic option, missing required field, unknown result | 422 |
| Expired-week entry before permission; permission grant | 403; 200 |
| POST /teams/T/operations, including additional unassigned work | 201 |
| Same operation request-key retry, verified same operation ID | 201 |
| POST /teams/T/submit-day, including retry | 200 |
| GET /notifications and coordinator review queue | 200 |
| POST /teams/T/operations/ID/review, approve or return | 200 |
| Stale review / simultaneous competing approval | 409 / 200 and 409 |
| PATCH returned operation; Submit Day again; corrected approval | 200 |
| Finalize with unresolved operations | 409 |
| GET /reports, coordinator productivity and manager snapshots | 200 |
| POST /teams/T/finalize after resolution | 200 |
| Finalized submission, operation edit, assignment edit | 409 |
| Weekly/monthly Excel and PDF exports | 200, all four |
| Same-team peer editing someone else's operation | 404 |
| Unrelated assignment; quantity on classification-only category | 422 |
| Employee category request; coordinator decision; repeat decision | 201; 200; 409 |
| Preference changes, notification read, audit-history read | 200 |
| Malformed JSON | 400 |
| Allowed frontend CORS request; preflight | 200; 204 |
| Untrusted origin | 200 with no Access-Control-Allow-Origin |
| POST /auth/logout | 200 |

The complete primary workflow created nine assigned operations and one additional operation. Submit Day submitted all ten; seven were approved and three returned, corrected, resubmitted and approved. Final productivity was **10**, target **10**, achievement **100%**, and result breakdown **Good 4 / Pending 3 / Bad 3**. Every approved result label contributes to productivity. Retry submission submitted zero additional records. All three finalized mutation attempts were rejected.

Supplemental quantity workflow approved two operations with total quantity five and no target; achievement was null. Quantity and operation productivity remained separate. Assignment removal persisted correctly. Excel files were parsed and their approved total verified; PDF responses were checked for PDF signatures. Both formats also have browser download coverage described below.

## Confirmed failures and fixes

1. Select labels included their option text, breaking exact accessible-name lookup. Fields now supply explicit accessible labels, including dynamic controls and the team/week selectors.
2. Missing favicon generated a browser 404. Added an empty data favicon.
3. The header overflowed at 768px. Its existing controls now wrap within available width.
4. Employee entry controls remained available after finalization although the API correctly rejected changes. The rendered page now shows the lock and disables/hides those actions.
5. Changing an assigned draft into additional work left its old assignment in MongoDB. PATCH now explicitly unsets the assignment. A regression test first reproduced the failure and passed after the fix; the actual Atlas API also passed.
6. A resolved cached connection promise prevented reconnect after the driver closed. Disconnected connections now clear that promise. A regression test first failed, then passed; real Atlas reuse/reconnection also passed.
7. React StrictMode restored the same session twice. Session restoration now shares its in-flight request and guards stale completion. The new StrictMode regression test passed; browser reload checks assert one successful session request per role.

An intermediate browser run was interrupted when formatting `index.html` caused Vite to reload and reset its selected week. This was recorded as a failed automation run, not an application workflow pass; the final full run uses stable source files.

## Rendered frontend results

The uninterrupted full Chrome run passed **45 checks** on the latest fixture, with **zero console errors and zero page/React runtime errors**. It executed the entire create/configure/assign/record/submit/review/return/correct/resubmit/approve/finalize workflow through actual forms and buttons. The browser week was September 28, separate from the API suite's October 5 week. Its three approved operations had Good, Pending and Bad results and all three counted as productivity.

Manager weekly and September monthly XLSX/PDF downloads all completed; the browser emitted 185 successful API responses (179 HTTP 200 and six HTTP 201). Required browser fields blocked submission without issuing a mutation. All six employee navigation destinations rendered. A same-team employee without assignments/operations saw the appropriate empty states. A deliberately delayed real API request showed loading before the empty result. Manager, coordinator and employee sessions survived reload with exactly one successful `/auth/me` request each.

All three roles passed viewport checks at 1440px, 768px and 390px. An additional verification run waits for populated table rows before repeating the responsive checks and taking mobile screenshots. Table and mobile navigation containers intentionally scroll within their boundaries.

The full run recorded 83 canceled requests (`net::ERR_ABORTED`) during StrictMode effect cleanup, navigation, filters and reloads; these are retained in the evidence, not counted as HTTP failures. There were no failed HTTP responses in the successful UI workflow. Duplicate successful session restoration was fixed; the canceled development lifecycle requests were not described as zero network activity. External changes in another session require refreshing the open view; no live cross-session synchronization is implemented. Reloading after finalization displayed the locked controls; the server rejected edits regardless of stale UI state.

## Vercel readiness and untested boundaries

Local lint, TypeScript, tests and production builds pass in both repositories: **19 backend tests and six frontend tests**. Backend tests use a disposable MongoDB replica set, never Atlas. Dependency audits found zero known vulnerabilities in both repositories. Node 22 is declared in both packages; the compiled backend smoke ran on Node 22.20.0. Express exports its app from `src/app.ts`; only local `src/server.ts` listens on a port. No background timer or persistent filesystem is required for request handling. XLSX/PDF exports are generated in memory. Database connections reuse the warm instance pool and transaction-backed workflows ran against Atlas.

Backend `vercel.json` selects Express. Frontend selects Vite, outputs `dist`, and rewrites SPA paths. Local API routing, exact-origin CORS, preflight and production compilation were executed. The architecture matches the official [Express](https://vercel.com/docs/frameworks/backend/express) and [Vite](https://vercel.com/docs/frameworks/frontend/vite) integrations. Vercel [function limits](https://vercel.com/docs/functions/limitations) still apply to larger exports and workloads.

**NOT TESTED:** actual Vercel runtime/cold starts, Preview URL routing/CORS, GitHub-hosted Actions, Git integration, deployment protection, production-sized export limits, live external email delivery/scheduling, and Atlas least-privilege/network configuration. No provider credentials were configured. Email unit tests use a mocked provider. No push or deployment was attempted. These are external acceptance items, not claimed passes.

## Exact steps before GitHub push

1. Review both independent repositories with `git status --short` and `git diff`; include the intended rebuild and audit fixes, and inspect deletions. The workspace parent is not a Git repository.
2. In each repository run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit`. On this Windows machine backend tests need `MONGOMS_SYSTEM_BINARY=C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe` and `MONGOMS_SYSTEM_BINARY_VERSION_CHECK=false` in the current shell; CI downloads a disposable binary.
3. For another live audit, run the local API and frontend servers, then backend `npx tsx scripts/local-api-audit.ts`, frontend `node scripts/local-browser-audit.mjs`, then backend `npx tsx scripts/local-edge-audit.ts`. Each primary run creates new isolated synthetic dev teams/accounts and replaces the private fixture file. Do not edit source while the browser suite runs. The installed Chrome channel is required.
4. Run `git diff --check` and inspect the staged diff. Verify `.env`, `.env.legacy`, `.env.local`, `.local-audit/`, credentials, exports and screenshots are ignored and absent from staged files. Never stage the private fixture.
5. Before enabling Vercel Git integration, prepare two projects with the appropriate repository roots. Backend variables: `MONGODB_URI` for the existing cluster, `MONGODB_DB_NAME=ops_dev_blue_bug_v2`, random `AUTH_SECRET`, and exact Preview frontend `FRONTEND_URL`. Frontend variable: `VITE_API_BASE_URL=https://<preview-api>/api/v1`. Vercel uses production runtime mode even for Preview; keep the database selection explicit. For this requested audit/Preview use the same isolated development database, never the legacy database. Obtain database-scoped credentials and verify permitted network access with the Atlas administrator.
6. Decide the Vercel production branch/integration settings so a later push has the intended deployment effect. After the user performs the push, require green GitHub checks and an explicitly authorized Preview smoke test across all roles, API health, finalized reports and exports. Live email requires separate provider/scheduler configuration and receipt verification before acceptance.

No local end-to-end blocker remains in the executed scenarios. Hosted acceptance remains pending; production readiness is not certified by a local audit. Exact statuses and check names are also available in the sanitized `local-audit-results.json` alongside this report.
