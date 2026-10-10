# GitHub ? Vercel

No push or deployment was performed.

Deploy backend and frontend as separate Vercel projects, rooted in their existing repositories. Use Node 22 and npm ci. Backend keeps Vercel's Express framework configuration and the exported Express app in src/app.ts. Build command: npm run build. Its database connector reuses a connection promise across warm requests and retries after failed connections.

Backend environment: MONGODB_URI, MONGODB_DB_NAME, AUTH_SECRET, FRONTEND_URL. Set FRONTEND_URL to the exact deployed frontend origin for CORS. Keep secrets in Vercel environment settings; never place MongoDB credentials or AUTH_SECRET in frontend variables. Choose the intended database for each deployment environment. Local development uses ops_dev_blue_bug_v2.

Frontend: Vite, build command npm run build, output dist. Set VITE_API_BASE_URL to https://YOUR-API.vercel.app/api/v1 before building. Existing SPA rewrites send all role URLs to index.html. /api/v1 remains on the separate backend origin; never rely on the frontend SPA rewrite as an API proxy. Same-origin hosting would require an explicit API rewrite before the SPA rule.

Atlas must allow the deployed API's network access. Validate login and CORS on the deployed origins before production use. Deployment has not been exercised here.

Team-removal migration is an explicit local maintenance command only. Never run db:remove-teams in Vercel build/startup. No business-data reset command remains. The application uses only users, categories, tasks, and task_entries.
