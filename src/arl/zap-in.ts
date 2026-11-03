/** arl:zap-in -- <pool> <concentrated|compounding> <tokenIn> <inputRaw> <swapRaw>. New position; no permanent lock. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { address, deployment } from "../shared/env.js";
import { printJson, slippage } from "../shared/input.js";
import { poolKind } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], poolKind(process.argv[3]));
  const plan = await c.sdk.planZapIn({ tokenIn: address("TOKEN_IN", process.argv[4]), amountIn: natural(process.argv[5], "inputRaw", true), swapAmount: natural(process.argv[6], "swapRaw", true), slippageBps: slippage(), recipient: c.caller, deadline: deadline(), lockDuration: 0, permanentLock: false });
  const router = deployment().contracts.routers.zap;
  if (!router || plan.router.toLowerCase() !== router.toLowerCase()) throw new Error("Zap router differs from reviewed deployment");
  printJson({ quote: plan.quote, positionAndRefundsReconciled: false });
  await execute("ARL single-token zap", { ...c, allowedTargets: [router] }, plan.transaction, plan.approvalRequirements);
});
