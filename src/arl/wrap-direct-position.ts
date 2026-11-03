/** arl:wrap-direct-position -- <pool> <poolNftId>. Grants approval only for this NFT, then wraps to self. */
import { encodeFunctionData, erc721Abi } from "viem";
import { arl, natural, execute } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]);
  const plan = await c.sdk.planWrapManagedConcentratedPosition({ poolPositionId: natural(process.argv[3], "poolNftId"), caller: c.caller, recipient: c.caller });
  const approval = plan.nftApprovalRequirement;
  if (approval.collection.toLowerCase() !== c.pool.toLowerCase() || approval.operator.toLowerCase() !== plan.transaction.to.toLowerCase()) throw new Error("Unexpected NFT approval binding");
  const current = await c.client.readContract({ address: c.pool, abi: erc721Abi, functionName: "getApproved", args: [approval.tokenId] });
  const transactions = current.toLowerCase() === approval.operator.toLowerCase() ? [plan.transaction] : [
    { to: c.pool, data: encodeFunctionData({ abi: erc721Abi, functionName: "approve", args: [approval.operator, approval.tokenId] }) }, plan.transaction];
  printJson({ approval, poolCollection: c.pool, managedCollection: approval.operator, managedNftId: "Resolve PositionWrapped from the receipt; never reuse poolNftId" });
  await execute("wrap direct concentrated position", c, transactions);
});
