import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeBatch } from "../src/shared/batch-execution.js";
import type { ActionContext } from "../src/shared/actions.js";
const caller="0x1111111111111111111111111111111111111111",target="0x2222222222222222222222222222222222222222";
const context={caller,allowedTargets:[target],client:{}} as unknown as ActionContext;
test("preview needs no wallet or RPC and an existing progress file stops send before key access",async()=>{
  const old=process.env.AMMORA_SEND,dir=mkdtempSync(join(tmpdir(),"ammora-batch-")),file=join(dir,"progress.json");
  try {
    process.env.AMMORA_SEND="0";
    assert.deepEqual(await executeBatch(context,[{to:target,data:"0x"}],undefined),[]);
    writeFileSync(file,'{"status":"SUBMITTING_OR_UNKNOWN","nonce":17}\n');
    process.env.AMMORA_SEND="1";
    await assert.rejects(executeBatch(context,[{to:target,data:"0x"}],file),/reconcile an existing\/unknown batch/);
    assert.equal(readFileSync(file,"utf8"),'{"status":"SUBMITTING_OR_UNKNOWN","nonce":17}\n');
    await assert.rejects(executeBatch(context,[{to:caller,data:"0x"}],file),/outside this action/);
  } finally {if(old===undefined)delete process.env.AMMORA_SEND;else process.env.AMMORA_SEND=old;rmSync(dir,{recursive:true});}
});
