import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as sdk from "@ammora-protocol/sdk";
import * as legacyPath from "../src/stablecoin/almm-readiness-compat.js";
import { allocation, createRequest, uint, assertReview, reviewHash } from "../src/vesting/policy.js";
const alloc = () => ({ totalAmountRaw: "1000", cliffUnlockAmountRaw: "100", numberOfPeriods: 3, frequencySeconds: "10", cliffDurationSeconds: "20", rounding: "reject" });
const request = () => ({ token: "0x"+"1".repeat(40), recipient: "0x"+"2".repeat(40), vestingStartTime: "1000", allocation: alloc(), userSalt: "0x"+"3".repeat(64), metadataHash: "0x"+"0".repeat(64) });
test("JSON boundary preserves large raw amounts and requires explicit dust handling", () => {
  assert.equal(allocation(alloc()).totalAmountRaw, 1000n);
  const input = { ...alloc(), totalAmountRaw: "1001" };
  assert.throws(() => allocation(input), /remainder/);
  const rounded = allocation({ ...input, rounding: "cliff" });
  assert.equal(rounded.totalAmountRaw, 1001n);assert.equal(rounded.roundingRemainderRaw, 1n);assert.equal(rounded.config.cliffUnlockAmount, 101n);
  assert.equal(uint("9007199254740993", "amount"), 9007199254740993n);
  for (const value of [1, "1e18", "1.0", "-1", "01", String(1n << 256n)]) assert.throws(() => uint(value, "amount"));
});
test("create requests bind beneficiary, absolute schedule and immutable actor modes", () => {
  const parsed = createRequest(request());assert.equal(parsed.parameters.cliffTime, 1020n);assert.equal(parsed.parameters.cancelMode, 0);assert.equal(parsed.parameters.updateRecipientMode, 0);
  for (const update of [{recipient:"0x"+"0".repeat(40)}, {token:"unresolved"}, {vestingStartTime:String(1n<<64n)}, {userSalt:"0x1234"}, {cancelMode:3}]) assert.throws(() => createRequest({...request(),...update}));
  assert.throws(() => createRequest({...request(),allocation:{...alloc(),extra:true}}));
});
test("approval and creation need distinct reviews and changing beneficiary/calldata invalidates consent", () => {
  const parsed = createRequest(request());
  const plan = { ...parsed, status:"APPROVAL_REQUIRED", creator:parsed.recipient, lock:parsed.token, salt:parsed.userSalt,totalAmount:1000n,transaction:{chainId:91342,to:parsed.token,data:"0x1234",value:0n} } as unknown as sdk.AmmoraTokenLockCreatePlan;
  const expected = reviewHash(plan);assertReview(plan,expected);assert.throws(()=>assertReview(plan,undefined));
  assert.throws(()=>assertReview({...plan,status:"READY"},expected));
  assert.throws(()=>assertReview({...plan,recipient:parsed.token},expected));
  assert.throws(()=>assertReview({...plan,transaction:{...plan.transaction,data:"0x5678"}},expected));
});
test("ALMM example import path now resolves the exact published SDK functions", () => {
  assert.equal(legacyPath.getALMMPresetReadiness,sdk.getALMMPresetReadiness);
  assert.equal(legacyPath.getALMMPositionReadiness,sdk.getALMMPositionReadiness);
  assert.equal(legacyPath.hashALMMPreset,sdk.hashALMMPreset);
});
test("old stablecoin plans cannot pass the execution boundary even with a valid review hash", () => {
  const dir = mkdtempSync(join(tmpdir(), "ammora-plan-version-"));
  try {
    for (const version of ["0.3.7", "0.3.8"]) {
      const payload = {schemaVersion:1,sdkVersion:version};
      const reviewHash = createHash("sha256").update(JSON.stringify(payload,null,2)).digest("hex");
      const file=join(dir,"plan.json");writeFileSync(file,JSON.stringify({...payload,reviewHash}));
      const result=spawnSync(process.execPath,["--import","tsx","src/stablecoin/execute.ts","unused.json",file,reviewHash],{encoding:"utf8",env:{...process.env,AMMORA_SEND:"0",AMMORA_PRIVATE_KEY:""}});
      assert.notEqual(result.status,0);
      assert.match(result.stderr+result.stdout,version==="0.3.7"?/Review hash\/schema mismatch/:/Execution needs AMMORA_SEND/);
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
