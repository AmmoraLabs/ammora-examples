/** arl:split-direct-position -- <pool> <kind> <poolNftId> <liquidityRaw>. Owner-only split to self. */
import { erc721Abi } from "viem";
import { arl, natural, execute } from "../shared/actions.js";
import { poolKind, requireOwner } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], poolKind(process.argv[3])), tokenId = natural(process.argv[4], "poolNftId");
  requireOwner(await c.client.readContract({ address: c.pool, abi: erc721Abi, functionName: "ownerOf", args: [tokenId] }), c.caller);
  const transaction = c.sdk.planSplitPosition(tokenId, natural(process.argv[5], "liquidityRaw", true), c.caller);
  // Raw builder alone does not establish authorization, lock or sufficient-liquidity validity.
  await c.client.call({ ...transaction, account: c.caller });
  await execute("split direct pool position", c, transaction);
});
