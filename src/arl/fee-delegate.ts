/** Fee-only managed NFT delegation. Only the NFT owner may grant or revoke it.
 * npm run arl:fee-delegate -- <pool> <managerNftId> <delegate> <claim-fee|claim-fee-to-owner>
 * npm run arl:fee-delegate -- <pool> <managerNftId> revoke
 */
import { AmmConcentratedV3PositionDelegatePermission, DammV2Client, ammConcentratedPositionManagerV3Abi } from "@ammora-protocol/sdk";
import { zeroAddress } from "viem";
import { address, clientOptions, deployment, reader, signer } from "../shared/env.js";
import { main, requireContract, send } from "../shared/run.js";

main(async () => {
  const [poolArg, idArg, delegateArg, mode, ...extra] = process.argv.slice(2);
  const pool = address("ARL_POOL", poolArg);
  if (!idArg || !/^\d+$/.test(idArg) || !delegateArg || extra.length) throw new Error("usage: <pool> <managerNftId> <delegate> <claim-fee|claim-fee-to-owner>, or <pool> <managerNftId> revoke");
  const tokenId = BigInt(idArg);
  const revoke = delegateArg === "revoke";
  if (revoke ? mode !== undefined : !["claim-fee", "claim-fee-to-owner"].includes(mode ?? "")) throw new Error("select claim-fee, claim-fee-to-owner, or revoke without a mode");
  const delegate = revoke ? zeroAddress : address("LP_FEE_DELEGATE", delegateArg);
  if (!revoke && delegate === zeroAddress) throw new Error("use revoke to clear fee delegation");
  const permission = revoke ? 0 : mode === "claim-fee"
    ? AmmConcentratedV3PositionDelegatePermission.ClaimFee
    : AmmConcentratedV3PositionDelegatePermission.ClaimFeeToOwner;
  const { wallet, account } = signer();
  if (!revoke && delegate.toLowerCase() === account.address.toLowerCase()) throw new Error("fee delegate must differ from the owner");
  const client = await reader();
  const contracts = deployment().contracts.launch;
  await requireContract(client, "pool", pool);
  const sdk = new DammV2Client(client, pool, "concentrated", contracts.concentratedFactory, contracts.concentratedPositionManager, clientOptions());
  // SDK authenticates the managed pool and requires the actual NFT owner. This
  // replaces the single delegate slot; it never ORs in unrelated permissions.
  const transaction = await sdk.planUpdateDelegatePermission(tokenId, delegate, permission, account.address);
  console.log(`position ${tokenId}: delegate ${delegate}, fee permission ${permission}`);
  const hash = await send("updateDelegatePermission", transaction, wallet, account, client);
  const receipt = await client.getTransactionReceipt({ hash });
  const manager = contracts.concentratedPositionManager;
  const actualDelegate = await client.readContract({ address: manager, abi: ammConcentratedPositionManagerV3Abi, functionName: "positionDelegate", args: [tokenId], blockNumber: receipt.blockNumber });
  const actualPermission = await client.readContract({ address: manager, abi: ammConcentratedPositionManagerV3Abi, functionName: "delegatePermission", args: [tokenId], blockNumber: receipt.blockNumber });
  if (actualDelegate.toLowerCase() !== delegate.toLowerCase() || Number(actualPermission) !== permission) throw new Error("Confirmed delegation differs from requested state; reconcile the existing receipt before continuing");
  console.log(`confirmed fee delegate ${actualDelegate}, permission ${actualPermission}`);
});
