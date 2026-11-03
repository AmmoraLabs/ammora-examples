import { reader } from "../shared/env.js";
import { main } from "../shared/run.js";
import { digest,json,load,same } from "./manifest.js";
import { readJournal } from "./journal.js";
import { receiptProof } from "./proof.js";
import type { Plan } from "./plans.js";
main(async()=>{const[planFile,journalFile,...extra]=process.argv.slice(2);if(!planFile||!journalFile||extra.length)throw new Error("usage: <plan.json> <journal.json>; read-only, never resumes or releases a lock");const p=load(planFile)as Plan,{reviewHash,...payload}=p,j=readJournal(journalFile);
  if(digest(payload)!==reviewHash||j.reviewHash!==reviewHash||j.chainId!==91342||!same(j.caller,p.caller))throw new Error("Plan/journal identity mismatch");
  const c=await reader();if(await c.getChainId()!==91342)throw new Error("GIWA only");const results=[];let actions=0;
  for(const e of j.entries){if(!e.hash||e.nonce===undefined){results.push({status:"UNKNOWN_WITHOUT_HASH",nonce:e.nonce});continue;}
    const r=await c.getTransactionReceipt({hash:e.hash}),t=await c.getTransaction({hash:e.hash}),b=await c.getBlock({blockNumber:r.blockNumber});
    if(r.status!=="success"||b.hash!==r.blockHash||!same(t.from,j.caller)||!t.to||!same(t.to,e.to)||t.input!==e.data||t.value!==BigInt(e.value)||t.nonce!==e.nonce)throw new Error("Journal receipt mismatch; no retry or resend");
    if(e.actionIndex!==undefined){results.push(await receiptProof(c,e.hash,p,e.actionIndex,e.nonce));actions++;}else results.push({hash:e.hash,canonical:true,nonce:e.nonce});
  }
  console.log(json({classification:actions===p.transactions.length&&results.length===j.entries.length&&j.entries.every(e=>!!e.hash)?"PASSED_THIS_RUN":"BLOCKED",journalStatus:j.status,results,latestNonce:await c.getTransactionCount({address:j.caller,blockTag:"latest"}),pendingNonce:await c.getTransactionCount({address:j.caller,blockTag:"pending"}),signing:false,resubmission:false,lockReleased:false,note:"Partial/unknown operations require operator audit. No automated continuation."}));});
