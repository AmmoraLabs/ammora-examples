import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeFunctionData, erc20Abi, keccak256, parseAbi, type Address } from "viem";
import { planERC20Approvals, type AmmoraTransaction } from "@ammora-protocol/sdk";
import { signer } from "../shared/env.js";
import { main } from "../shared/run.js";
import { context } from "./context.js";
import { digest, json, load, same, type Manifest } from "./manifest.js";
import { makePlan, type Plan } from "./plans.js";
import { reserve } from "./journal.js";
import { receiptProof } from "./proof.js";

export async function executeReviewed(file:string,plan:Plan,reviewHash:string) {
  const {reviewHash:stored,...payload}=plan;
  if(stored!==reviewHash||digest(payload)!==reviewHash||!/^[a-f0-9]{64}$/.test(reviewHash)||plan.sdkVersion!=="0.3.8"||plan.schemaVersion!==1)throw new Error("Review hash/schema mismatch");
  if(process.env.AMMORA_SEND!=="1")throw new Error("Execution needs AMMORA_SEND=1; planning is always unsigned");
  const refreshed=await makePlan(plan.operation,file,plan.request,plan.expiresAt),binding=(p:Plan)=>({operation:p.operation,manifestDigest:p.manifestDigest,caller:p.caller,assets:p.assets,request:p.request,transactions:p.transactions,approvals:p.approvals,expectation:p.expectation});
  if(digest(binding(refreshed))!==digest(binding(plan)))throw new Error("Plan changed with current state; review a NEW plan, never reuse the old hash");
  const exposure=["swap","add","seed-almm","create-arl","create-almm","create-almm-preset"].includes(plan.operation),c=await context(file,exposure,plan.expectation.kind==="create-pool"?undefined:plan.expectation.pool);
  if(digest(c.m)!==plan.manifestDigest||!same(c.caller,plan.caller))throw new Error("Manifest/caller changed");
  const canonical=await c.client.getBlock({blockNumber:BigInt(plan.snapshot.number)});if(canonical.hash!==plan.snapshot.hash)throw new Error("Original plan block no longer canonical");
  const tokens=[c.m.base.address!,c.m.quote.address!],targets=[c.factory,c.registry,c.manager,...(c.m.model==="almm"?[c.rewardManager]:[]),...(c.pool?[c.pool]:[])];
  for(const t of plan.transactions)if(!targets.some(a=>same(a,t.to))||BigInt(t.value??0)!==0n)throw new Error("Transaction outside authenticated targets or nonzero native value");
  for(const a of plan.approvals)if(!tokens.some(t=>same(t,a.token))||!targets.some(t=>same(t,a.spender)))throw new Error("Approval outside pair/authenticated spender");
  const initialNonce=await c.client.getTransactionCount({address:c.caller,blockTag:"latest"});if(initialNonce!==await c.client.getTransactionCount({address:c.caller,blockTag:"pending"}))throw new Error("Pending nonce must be reconciled before signing");
  const approvals=await planERC20Approvals(c.c,c.caller,plan.approvals),baselines=[];
  for(const a of plan.approvals)baselines.push({...a,baseline:await c.c.readContract({address:a.token,abi:erc20Abi,functionName:"allowance",args:[c.caller,a.spender]})});
  const directory=process.env.AMMORA_STABLECOIN_STATE_DIR??join(process.cwd(),".validation/stablecoin-journal"),journal=reserve(directory,c.caller,reviewHash,plan.operation);
  // No key is read until identity, limits, current planner and pending nonce checks plus durable reservation pass.
  const {wallet,account}=signer();if(!same(account.address,c.caller))throw new Error("Signer mismatch; journal retained");
  let nonce=initialNonce,reservedGas=0n;const cap=BigInt(c.m.policy.maxGasWei),results:Awaited<ReturnType<typeof receiptProof>>[]=[];
  const transmit=async(tx:AmmoraTransaction,phase:string,actionIndex?:number)=>{
    if(await c.client.getTransactionCount({address:c.caller,blockTag:"pending"})!==nonce||await c.client.getTransactionCount({address:c.caller,blockTag:"latest"})!==nonce)throw new Error("Nonce changed; stop and reconcile journal");
    const request={to:tx.to,data:tx.data,value:BigInt(tx.value??0)};
    await c.client.call({account:c.caller,...request});
    const gas=(await c.client.estimateGas({account:c.caller,...request}))*12n/10n,maxFeePerGas=(await c.client.getGasPrice())*2n+1n;
    reservedGas+=gas*maxFeePerGas;if(reservedGas>cap||reservedGas>await c.client.getBalance({address:c.caller}))throw new Error("Reviewed native gas budget exceeded");
    const entry={...request,value:String(request.value),phase:"SIGNING_OR_UNKNOWN",actionIndex,nonce,hash:undefined as `0x${string}`|undefined,blockNumber:undefined as string|undefined,blockHash:undefined as `0x${string}`|undefined};journal.value.entries.push(entry);journal.value.status=phase;journal.save();
    const signed=await wallet.signTransaction({...request,chain:wallet.chain,account,nonce,gas,maxFeePerGas,maxPriorityFeePerGas:0n}),hash=keccak256(signed);entry.hash=hash;entry.phase="SIGNED_NOT_CONFIRMED";journal.save();
    console.log(json({hash,nonce,phase,journal:journal.file}));
    // Hash is durable before RPC. A lost response MUST NOT cause another submission.
    const returned=await c.client.sendRawTransaction({serializedTransaction:signed});if(returned!==hash)throw new Error("RPC returned a different hash");
    const receipt=await c.client.waitForTransactionReceipt({hash,confirmations:13,retryCount:0,timeout:120000,pollingInterval:3000});
    if(receipt.status!=="success"||(await c.client.getBlock({blockNumber:receipt.blockNumber})).hash!==receipt.blockHash)throw new Error("Unsuccessful/noncanonical receipt; reconcile");
    entry.phase="CONFIRMED";entry.blockNumber=String(receipt.blockNumber);entry.blockHash=receipt.blockHash;journal.save();
    if(actionIndex!==undefined)results.push(await receiptProof(c.client,hash,plan,actionIndex,nonce));nonce++;return receipt;
  };
  for(const p of approvals)for(const tx of p.transactions)await transmit(tx,"APPROVAL");
  // Recheck issuer/runtime/reference/price after approval latency; exits don't require a fresh peg reference.
  await context(file,exposure,plan.expectation.kind==="create-pool"?undefined:plan.expectation.pool);
  for(let i=0;i<plan.transactions.length;i++){if(Number((await c.client.getBlock()).timestamp)>=plan.expiresAt)throw new Error("Plan expired; preserve approvals and journal for reconciliation");await transmit(plan.transactions[i]!,"ACTION",i);}
  for(const a of baselines){const current=await c.client.readContract({address:a.token,abi:erc20Abi,functionName:"allowance",args:[c.caller,a.spender]});if(current>a.baseline)await transmit({to:a.token,data:encodeFunctionData({abi:erc20Abi,functionName:"approve",args:[a.spender,a.baseline]})},"RESTORE_ALLOWANCE");}
  journal.complete();console.log(json({operation:plan.operation,journal:journal.file,executionConfirmed:true,payoutVerified:false,note:"Read operation-specific receipt proof; successful execution alone is not a fee payout",results}));
}
main(async()=>{const[file,planFile,reviewHash,...extra]=process.argv.slice(2);if(!file||!planFile||!reviewHash||extra.length)throw new Error("usage: <manifest.json> <plan.json> <reviewHash>");await executeReviewed(file,load(planFile) as Plan,reviewHash);});
