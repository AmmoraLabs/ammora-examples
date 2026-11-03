/** fees:operator-batch-claim -- <feeVault> <requests.json>. Existing owner/operator only; pays beneficiaries themselves. */
import { buildBatchFeeClaims } from "@ammora-protocol/sdk";
import { feeVaultContext } from "./context.js";
import { document, object, nonzero } from "./policy.js";
import { execute } from "../shared/actions.js";
import { signer } from "../shared/env.js";
import { main, send } from "../shared/run.js";
import { printJson } from "../shared/input.js";
import { tokenCredit } from "./token-credit.js";
main(async () => {
  const c=await feeVaultContext(process.argv[2]), value=document(process.argv[3]);
  if (c.owner.toLowerCase() !== c.caller.toLowerCase() && !await c.client.readContract({ address:c.vault,abi:c.abi,functionName:"operator",args:[c.caller] })) throw new Error("Existing FeeVault owner/operator required; no role is granted here");
  if (!Array.isArray(value) || value.length<1 || value.length>16) throw new Error("Provide 1–16 operator requests");
  const seen=new Set<string>();
  const requests=[];
  for(const item of value) {
    const r=object(item,["token","recipient"]),token=nonzero(r.token,"token"),recipient=nonzero(r.recipient,"recipient"),key=`${token}:${recipient}`.toLowerCase();
    if(seen.has(key) || recipient===c.vault) throw new Error("Duplicate entitlement or vault recipient");
    seen.add(key);
    const amount=await c.client.readContract({address:c.vault,abi:c.abi,functionName:"claimable",args:[token,recipient]});
    if(amount===0n) { printJson({skipped:{token,recipient},reason:"ZERO_FEE_NO_PAYMENT"});continue; }
    requests.push({token,recipient});
  }
  if(!requests.length)return;
  const transaction={to:c.vault,...buildBatchFeeClaims(requests)};
  printJson({requests,note:"Single batchClaim; each recipient is BOTH beneficiary and payout. No alternate payout or new permission."});
  if(process.env.AMMORA_SEND!=="1")return execute("operator FeeVault batch",c,transaction);
  const {wallet,account}=signer();if(account.address.toLowerCase()!==c.caller.toLowerCase())throw new Error("Caller/signer mismatch");
  const hash=await send("operator FeeVault batch",transaction,wallet,account,c.client);
  for(const r of requests)printJson(await tokenCredit(c.client,hash,r.token,r.recipient));
});
