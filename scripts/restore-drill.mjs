import "dotenv/config";
import {execFileSync} from "node:child_process";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import pg from "pg";

// Always fail closed against remote databases, even if legacy override flags exist.
const source=process.env.DATABASE_URL;
const url=source?new URL(source):null;
if(!url||!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw Error("Use a local disposable database. Hosted recovery must use an isolated provider restore branch.");
const drillName="reppilot_drill_"+randomUUID().replaceAll("-","");
const adminUrl=new URL(url);adminUrl.pathname="/postgres";
const drillUrl=new URL(url);drillUrl.pathname="/"+drillName;
const directory=await mkdtemp(join(tmpdir(),"reppilot-restore-")),dump=join(directory,"backup.dump");
const admin=new pg.Client({connectionString:String(adminUrl)}),original=new pg.Client({connectionString:source}),restored=new pg.Client({connectionString:String(drillUrl)});
let created=false;
const quote=v=>'"'+v.replaceAll('"','""')+'"';
async function signature(client,table){
 // Sorted row hashes verify contents as well as counts without emitting records.
 const r=await client.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(row_hash, '' ORDER BY row_hash),'')) AS digest FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public.${quote(table)} t) hashes`);
 return r.rows[0];
}
try{
 await admin.connect();await original.connect();
 await original.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const snapshot=(await original.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
 const tables=(await original.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
 await admin.query(`CREATE DATABASE ${quote(drillName)}`);created=true;
 execFileSync("pg_dump",["--format=custom","--no-owner","--snapshot",snapshot,"--file",dump,source],{stdio:"pipe"});
 execFileSync("pg_restore",["--exit-on-error","--no-owner","--dbname",String(drillUrl),dump],{stdio:"pipe"});
 await restored.connect();
 for(const table of tables){
  const a=await signature(original,table),b=await signature(restored,table);
  if(a.n!==b.n||a.digest!==b.digest)throw Error("Restored table content mismatch: "+table);
 }
 console.log(`PASS: snapshot-consistent dump restored; contents of all ${tables.length} tables matched. Disposable database only.`);
} catch(error){
 // Do not print child-process arguments/output, which may contain credentials or data.
 console.error("Restore drill failed. Inspect the local PostgreSQL setup and tool versions.");
 process.exitCode=1;
} finally{
 await restored.end().catch(()=>{});await original.end().catch(()=>{});
 if(created)await admin.query(`DROP DATABASE ${quote(drillName)}`).catch(()=>{console.error("Disposable restore database cleanup failed: "+drillName);process.exitCode=1;});
 await admin.end().catch(()=>{});await rm(directory,{recursive:true,force:true});
}
