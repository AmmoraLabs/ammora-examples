import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync,readFileSync,writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { reserve,readJournal } from "../src/stablecoin/journal.js";
const caller="0x3333333333333333333333333333333333333333";
test("durable journal preserves signed/unknown hash, account exclusion and completed operation uniqueness",()=>{
  const dir=mkdtempSync(join(tmpdir(),"stablecoin-journal-"));try{
    const j=reserve(dir,caller,"a".repeat(64),"swap");assert.throws(()=>reserve(dir,caller,"b".repeat(64),"swap"),/EEXIST/);
    j.value.entries.push({to:caller,data:"0x12",value:"0",phase:"SIGNED_NOT_CONFIRMED",nonce:7,hash:"0x"+"1".repeat(64)as `0x${string}`});j.save();assert.equal(readJournal(j.file).entries[0]!.nonce,7);
    const preserved=readFileSync(j.file,"utf8");assert.throws(()=>reserve(dir,caller,"a".repeat(64),"swap"));assert.equal(readFileSync(j.file,"utf8"),preserved);
    assert.throws(()=>j.complete(),/unknown\/pending/);j.value.entries[0]!.phase="CONFIRMED";j.complete();assert.throws(()=>reserve(dir,caller,"a".repeat(64),"swap"),/EEXIST/);const next=reserve(dir,caller,"c".repeat(64),"quote");next.complete();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test("two independent processes cannot reserve the same account concurrently",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"stablecoin-race-"));try{
    const module=new URL("../src/stablecoin/journal.ts",import.meta.url).href;
    const run=(h:string)=>new Promise<number|null>((resolve,reject)=>{const c=spawn(process.execPath,["--import","tsx","--input-type=module","-e",`import{reserve}from ${JSON.stringify(module)};try{reserve(${JSON.stringify(dir)},${JSON.stringify(caller)},${JSON.stringify(h.repeat(64))},"swap");process.exit(0)}catch{process.exit(7)}`],{stdio:"ignore"});c.on("exit",resolve);c.on("error",reject);});
    assert.deepEqual((await Promise.all([run("d"),run("e")])).sort(),[0,7]);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
