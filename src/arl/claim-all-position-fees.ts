/** arl:claim-all-position-fees -- <pool> <positions.json> <payout> [new-progress.json]. Concentrated pool/Manager IDs only. */
import { arl, natural } from "../shared/actions.js";
import { document, nonzero, object } from "../fees/policy.js";
import { executeBatch } from "../shared/batch-execution.js";
import { tokenCredit } from "../fees/token-credit.js";
import { main } from "../shared/run.js";
import { printJson } from "../shared/input.js";
main(async () => {
  const c = await arl(process.argv[2]), value = document(process.argv[3]), recipient = nonzero(process.argv[4], "payout");
  if (!Array.isArray(value) || value.length<1 || value.length>16) throw new Error("Provide 1–16 positions");
  const positions = value.map(entry => {
    const r = object(entry, ["tokenId", "sourceKind"]);
    if (r.sourceKind !== "RAW_POOL" && r.sourceKind !== "POSITION_MANAGER") throw new Error("Explicit sourceKind RAW_POOL or POSITION_MANAGER required");
    return { tokenId: natural(String(r.tokenId), "tokenId"), sourceKind: r.sourceKind as "RAW_POOL" | "POSITION_MANAGER" };
  });
  const plan = await c.sdk.planClaimAllPositionFees({ positions, caller: c.caller, recipient });
  printJson({ positions, recipient, atomic: false, note: "Pool NFT and Manager NFT are distinct collections; zero credit is not payment" });
  const hashes = await executeBatch(c, plan.transactions, process.argv[5]);
  for (const hash of hashes) for (const token of [c.state.baseToken, c.state.quoteToken]) printJson(await tokenCredit(c.client, hash, token, recipient));
});
