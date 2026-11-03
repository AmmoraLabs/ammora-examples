/** fees:batch-claim -- <requests.json> [new-progress.json]. Sequential own/delegated claims. */
import { buildClaimFeeVaultFor } from "@ammora-protocol/sdk";
import { feeVaultContext } from "./context.js";
import { document, feeRequests } from "./policy.js";
import { tokenCredit } from "./token-credit.js";
import { executeBatch } from "../shared/batch-execution.js";
import { main } from "../shared/run.js";
import { printJson } from "../shared/input.js";
main(async () => {
  const requests = feeRequests(document(process.argv[2]));
  const prepared = [];
  for (const request of requests) {
    const c = await feeVaultContext(request.vault);
    if (request.beneficiary.toLowerCase() !== c.caller.toLowerCase() && !await c.client.readContract({ address: c.vault, abi: c.abi, functionName: "claimDelegate", args: [request.beneficiary, c.caller] })) throw new Error("Caller lacks beneficiary delegation");
    const amount = await c.client.readContract({ address: c.vault, abi: c.abi, functionName: "claimable", args: [request.token, request.beneficiary] });
    if (amount === 0n) { printJson({ skipped: request, reason: "ZERO_FEE_NO_PAYMENT" }); continue; }
    prepared.push({ c, request, transaction: { to: c.vault, ...buildClaimFeeVaultFor(request.token, request.beneficiary, request.payout) } });
  }
  if (!prepared.length) return;
  const c = { ...prepared[0]!.c, allowedTargets: prepared.map(p => p.c.vault) };
  const hashes = await executeBatch(c, prepared.map(p => p.transaction), process.argv[3]);
  for (let i=0; i<hashes.length; i++) { const r=prepared[i]!.request; printJson(await tokenCredit(c.client, hashes[i]!, r.token, r.payout)); }
});
