/** arl:resolve-added-position -- <pool> <concentrated|compounding> <txHash>. Canonical receipt read only. */
import { arl } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { poolKind } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const hash = process.argv[4];
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? "")) throw new Error("Supply an add-liquidity transaction hash");
  const c = await arl(process.argv[2], poolKind(process.argv[3]));
  const receipt = await c.client.getTransactionReceipt({ hash: hash as `0x${string}` });
  const block = await c.client.getBlock({ blockNumber: receipt.blockNumber });
  if (receipt.status !== "success" || block.hash !== receipt.blockHash) throw new Error("Receipt is reverted or not canonical");
  const position = c.sdk.resolveAddedLiquidityPosition(receipt, c.caller);
  printJson({ collection: c.pool, position, blockNumber: receipt.blockNumber, blockHash: block.hash, currentOwnershipVerified: false, sendEnabled: false });
});
