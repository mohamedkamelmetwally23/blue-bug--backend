import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { pullSheet } from "./features/google-sheets/google-sheets.service.js";

await connectDatabase();
if (env.GOOGLE_SHEETS_SYNC_ENABLED && env.GOOGLE_SHEETS_INITIAL_SYNC) {
  await pullSheet();
}
createApp().listen(env.PORT, () => { console.log(`API listening on port ${env.PORT}`); });
