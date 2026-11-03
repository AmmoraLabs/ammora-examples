import test from "node:test";
import assert from "node:assert/strict";
import { feeRequests, rebalancePolicy } from "../src/fees/policy.js";
import { sourcePolicy, sourcePermission } from "../src/dfs/source-policy.js";
const a="0x1111111111111111111111111111111111111111",b="0x2222222222222222222222222222222222222222",c="0x3333333333333333333333333333333333333333";
const request={vault:a,token:b,beneficiary:c,payout:b};
test("a payout does not create another entitlement and batches remain bounded",()=>{
  assert.equal(feeRequests([request])[0]!.beneficiary,c);
  assert.throws(()=>feeRequests([request,{...request,payout:c}]),/Duplicate entitlement/);
  assert.throws(()=>feeRequests([{...request,payout:a}]),/outside the vault/);
  assert.throws(()=>feeRequests(Array(17).fill(request)),/1–16/);
  assert.throws(()=>feeRequests([{...request,operator:true}]),/Unknown JSON field/);
});
test("source kind selects exact NFT/token/reward semantics",()=>{
  assert.deepEqual(sourcePolicy({kind:"delegatedFeeVault",source:a,beneficiary:b}),{kind:"delegatedFeeVault",source:a,beneficiary:b});
  assert.throws(()=>sourcePolicy({kind:"feeVault",source:a,beneficiary:b}),/Unknown JSON field/);
  assert.throws(()=>sourcePolicy({kind:"concentratedFee",source:a,tokenId:"5",sourceKind:"rawPool",tokenIsBase:"false"}),/boolean/);
  assert.throws(()=>sourcePolicy({kind:"positionReward",source:a,tokenId:"5",sourceKind:"positionManager",index:2}),/slot/);
  assert.equal(sourcePolicy({kind:"compoundingFee",source:a,tokenId:"9007199254740993"}).kind,"compoundingFee");
});
test("a one-token DFS cannot request a combined or principal permission",()=>{
  assert.equal(sourcePermission("fee"),8);assert.equal(sourcePermission("reward"),32);assert.equal(sourcePermission("revoke"),0);
  assert.throws(()=>sourcePermission("fee-and-reward"),/combined permissions/);
  assert.throws(()=>sourcePermission("remove-liquidity"),/combined permissions/);
});
const rebalance={tokenId:"5",withdrawals:[{binId:-1,shares:"200"}],deposits:[{binId:0,baseAmount:"10",quoteAmount:"20"}],slippageBps:50,maxActiveBinSlippage:1,recipient:c,deadline:"9999999999"};
test("rebalance preserves raw precision and refuses ambiguous/empty bin requests",()=>{
  const p=rebalancePolicy(rebalance);assert.equal(p.withdrawals[0]!.shares,200n);
  assert.throws(()=>rebalancePolicy({...rebalance,withdrawals:[{binId:-1,shares:200}]}),/raw integer string/);
  assert.throws(()=>rebalancePolicy({...rebalance,withdrawals:[...rebalance.withdrawals,...rebalance.withdrawals]}),/unique/);
  assert.throws(()=>rebalancePolicy({...rebalance,deposits:[{binId:8388608,baseAmount:"1",quoteAmount:"0"}]}),/int24/);
  assert.throws(()=>rebalancePolicy({...rebalance,withdrawals:[],deposits:[]}),/1–64/);
  assert.throws(()=>rebalancePolicy({...rebalance,maxActiveBinSlippage:101}),/reviewed range/);
  assert.throws(()=>rebalancePolicy({...rebalance,slippageBps:10000}),/reviewed range/);
});
