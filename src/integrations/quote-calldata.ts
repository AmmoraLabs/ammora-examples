/** npm run integration:quote -- <concentrated|compounding> <pool> <tokenIn> <amountInRaw> <recipient> */
import { quoteAmmoraExactIn, buildAmmoraExactInCalldata } from "@ammora-protocol/sdk/integrate";
import { resolveDammV2PoolProvenance, minOutFromSlippage } from "@ammora-protocol/sdk";
import { address, clientOptions, reader } from "../shared/env.js";
import { printJson, rawAmount, slippage } from "../shared/input.js";
import { main } from "../shared/run.js";

main(async () => {
  const [poolKind, poolArg, inArg, raw, recipientArg] = process.argv.slice(2);
  if (poolKind !== "concentrated" && poolKind !== "compounding") throw new Error("poolKind must be concentrated or compounding");
  const pool = address("AMMORA_POOL", poolArg);
  const tokenIn = address("TOKEN_IN", inArg);
  const recipient = address("AMMORA_RECIPIENT", recipientArg);
  const amountIn = rawAmount(raw, "amountInRaw");
  const client = await reader();
  const block = await client.getBlock({ blockTag: "latest" });
  // The lightweight subpath intentionally omits provenance. Establish it explicitly.
  const provenance = await resolveDammV2PoolProvenance(client, pool, poolKind, { blockNumber: block.number, ...clientOptions() });
  const request = { poolKind: poolKind as "concentrated" | "compounding", pool, tokenIn, amountIn, blockNumber: block.number };
  const expectedAmountOut = await quoteAmmoraExactIn(client, request);
  const transaction = buildAmmoraExactInCalldata({ ...request, recipient, minimumAmountOut: minOutFromSlippage(expectedAmountOut, BigInt(slippage())), deadline: block.timestamp + 600n });
  printJson({ blockNumber: block.number, provenance, expectedAmountOut, transaction, note: "Calldata preview only. Approve the returned spender and re-quote before sending." });
});
