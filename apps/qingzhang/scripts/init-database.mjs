import "./sites-env.mjs";
import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
const names=(await readdir("drizzle")).filter(n=>n.endsWith(".sql")).sort();
await mkdir(".deploy",{recursive:true});
await writeFile(".deploy/initialize.sql",(await Promise.all(names.map(n=>readFile("drizzle/"+n,"utf8")))).join("\n"));
const run=spawnSync(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--config","dist/server/wrangler.json","--persist-to",".wrangler/state","--file",".deploy/initialize.sql"],{stdio:"inherit"});
process.exit(run.status??1);
