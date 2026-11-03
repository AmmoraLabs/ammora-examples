/** almm:rebalance -- <pool> <rebalance.json>. Default unsigned preview; integer raw units. */
import { almm, execute } from "../shared/actions.js";
import { document, rebalancePolicy } from "../fees/policy.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await almm(process.argv[2]), policy = rebalancePolicy(document(process.argv[3]));
  if (policy.deadline <= BigInt(Math.floor(Date.now()/1000))) throw new Error("Rebalance deadline expired");
  const plan = await c.sdk.planRebalancePosition({ ...policy, caller: c.caller });
  printJson({ quote: plan.quote, tokenId: policy.tokenId, recipient: policy.recipient, warning: "Changes principal allocation; verify shares, inputs/refunds and unchanged NFT owner after receipt" });
  await execute("rebalance ALMM position", c, plan.transaction, plan.approvalRequirements);
});
