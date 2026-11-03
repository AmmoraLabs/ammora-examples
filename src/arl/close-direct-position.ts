/** arl:close-direct-position -- <concentratedPool> <emptyPoolNftId>. Compounding burns on full removal. */
import { erc721Abi } from "viem";
import { arl, natural, execute } from "../shared/actions.js";
import { requireOwner } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]), tokenId = natural(process.argv[3], "emptyPoolNftId");
  requireOwner(await c.client.readContract({ address: c.pool, abi: erc721Abi, functionName: "ownerOf", args: [tokenId] }), c.caller);
  const transaction = c.sdk.planCloseEmptyPosition(tokenId);
  await c.client.call({ ...transaction, account: c.caller }); // Refuses liquidity or unclaimed obligations.
  await execute("close empty direct concentrated position", c, transaction);
});
