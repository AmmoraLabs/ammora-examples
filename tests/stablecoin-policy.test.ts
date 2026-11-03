import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { manifest, unresolved, requireResolved, raw,staticArlFee } from "../src/stablecoin/manifest.js";
import { quoteFloor, priceGuard, referenceGuard,checkAuthorities,withdrawalBoundary } from "../src/stablecoin/context.js";
import type { PublicClient } from "viem";

const template=()=>JSON.parse(readFileSync(new URL("../src/stablecoin/manifests/native-issuer.template.json",import.meta.url),"utf8"));
const resolved=()=>{
  const m=template();m.origin={kind:"synthetic-test",issuer:"AMMORA_SYNTHETIC_QUALIFICATION",status:"reviewed",evidence:"test source digest, not FDUSD/cUSD"};
  for(const[k,i,decimals]of[["base","1",6],["quote","2",18]]as const)m[k]={label:"TEST_"+k,address:"0x"+i.repeat(40),decimals,codeHash:"0x"+"a".repeat(64),proxy:{kind:"immutable"},review:{status:"reviewed",evidence:"review",controls:"fixed test control",pausedGetter:false,blacklistGetter:false,authorities:[{kind:"owner",account:"0x"+"3".repeat(40)}]}};
  m.roles={liquidityOwner:"0x"+"3".repeat(40),payout:"0x"+"4".repeat(40),feeDelegate:null};m.reference.observedAt=1000;return manifest(m);
};
test("native issuer templates remain unresolved; malformed fields and other chains fail",()=>{
  const pending=manifest(template());assert(unresolved(pending).includes("base decimals"));assert.throws(()=>requireResolved(pending),/BLOCKED_UNRESOLVED/);
  for(const mutate of[(m:any)=>m.chainId=1,(m:any)=>m.factory="0x"+"5".repeat(40),(m:any)=>m.base.decimals=19,(m:any)=>m.policy.maxFeeBps=0.1,(m:any)=>m.base.address="0x"+"0".repeat(40)]){const m=template();mutate(m);assert.throws(()=>manifest(m));}
  for(const n of["1e6","-1","01","0x10",(2n**256n).toString()])assert.throws(()=>raw(n));
});
test("reviewed owner/role drift blocks reuse even when token runtime is unchanged",async()=>{
  const m=resolved(),good={readContract:async()=>m.roles.liquidityOwner!}as unknown as PublicClient,bad={readContract:async()=>m.roles.payout!}as unknown as PublicClient;
  assert.equal((await checkAuthorities(good,m.base)).length,1);await assert.rejects(()=>checkAuthorities(bad,m.base),/AUTHORITY_CHANGED/);
  m.base.review.authorities=[{kind:"role",role:`0x${"0".repeat(64)}`,account:m.roles.liquidityOwner!,allowed:true}];
  await assert.rejects(()=>checkAuthorities({readContract:async()=>false}as unknown as PublicClient,m.base),/AUTHORITY_CHANGED/);
});
test("ALMM canonical token order cannot silently change reviewed decimals or budgets",()=>{
  const m=resolved();m.model="almm";assert.doesNotThrow(()=>manifest(m));
  [m.base,m.quote]=[m.quote,m.base];assert.throws(()=>manifest(m),/BLOCKED_ALMM_TOKEN_ORDER/);
  m.model="arl";assert.doesNotThrow(()=>manifest(m));
});
test("6/18 decimal quote costs work in both directions; fees/depeg/stale references stop new exposure",()=>{
  const m=resolved();requireResolved(m);
  assert.equal(quoteFloor(m,true,1_000_000n,999_000_000_000_000_000n),1_000_000_000_000_000_000n);
  assert.equal(quoteFloor(m,false,1_000_000_000_000_000_000n,999_000n),1_000_000n);
  assert.throws(()=>quoteFloor(m,true,1_000_000n,900_000_000_000_000_000n),/NET_COST/);
  assert.throws(()=>priceGuard(m,950_000_000_000_000_000n),/PRICE_DEVIATION/);
  assert.throws(()=>referenceGuard(m,999),/STALE_REFERENCE/);assert.throws(()=>referenceGuard(m,1000+m.reference.maxAgeSeconds+1),/STALE_REFERENCE/);
});
test("public 0.3.7 ARL fee floor is explicit and never raises a partner request/cap",()=>{
  assert.throws(()=>staticArlFee(1,25),/BLOCKED_ARL_FEE_FLOOR/);assert.throws(()=>staticArlFee(25,1));assert.equal(staticArlFee(25,25),25);
});
test("final ARL LP withdrawal reports retained raw liquidity without inventing a full exit",()=>{
  assert.equal(withdrawalBoundary(100n,20n).maximumWithdrawalLiquidityRaw,"20");
  const last=withdrawalBoundary(100n,100n);assert.equal(last.maximumWithdrawalLiquidityRaw,"99");assert.equal(last.positionRemainderIfMaximumRaw,"1");assert.equal(last.fullPoolCloseSupported,false);
  assert.equal(withdrawalBoundary(1n,1n).maximumWithdrawalLiquidityRaw,"0");assert.throws(()=>withdrawalBoundary(5n,6n));
});
test("pending issuer inspect and tampered execution stop before RPC/key access even with SEND=1",()=>{
  const dir=mkdtempSync(join(tmpdir(),"stablecoin-blocked-"));try{
    const env={...process.env,AMMORA_SEND:"1",AMMORA_CHAIN_ID:"91342",AMMORA_GIWA_GENERATION:"auto-route",AMMORA_RPC_URL:"http://127.0.0.1:1",AMMORA_PRIVATE_KEY:"MUST_NOT_BE_READ"};
    const r=spawnSync(process.execPath,["--import","tsx","src/stablecoin/inspect-asset.ts","src/stablecoin/manifests/fdusd.template.json"],{encoding:"utf8",env});assert.equal(r.status,0);const result=JSON.parse(r.stdout);assert.equal(result.classification,"BLOCKED");assert.equal(result.rpc,false);assert.equal(result.signing,false);
    const p=join(dir,"bad.json");writeFileSync(p,JSON.stringify({schemaVersion:1,sdkVersion:"0.3.7",reviewHash:"0".repeat(64)}));
    const e=spawnSync(process.execPath,["--import","tsx","src/stablecoin/execute.ts","src/stablecoin/manifests/fdusd.template.json",p,"0".repeat(64)],{encoding:"utf8",env});assert.notEqual(e.status,0);assert.match(e.stderr,/Review hash/);assert.doesNotMatch(e.stderr,/PRIVATE_KEY|Could not reach|RPC/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
