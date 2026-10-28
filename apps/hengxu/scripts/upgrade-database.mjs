import "./sites-env.mjs";
import {spawnSync} from "node:child_process";
// Existing installations already contain 0000; apply only the additive, repeatable upgrade.
const run=spawnSync(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--config","dist/server/wrangler.json","--persist-to",".wrangler/state","--file","drizzle/0001_activity.sql"],{stdio:"inherit"});
process.exit(run.status??1);
