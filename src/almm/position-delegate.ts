/** ALMM delegation can grant principal rights: choose the exact permission, never copy ARL fee-only masks. */
import { ALMMPositionPermission } from "@ammora-protocol/sdk";
import { almm, natural, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { main } from "../shared/run.js";
main(async () => {
  const choices: Record<string, number> = { revoke: 0, add: ALMMPositionPermission.AddLiquidity,
    remove: ALMMPositionPermission.RemoveLiquidity, "remove-to-owner": ALMMPositionPermission.RemoveToOwner };
  const permission = choices[process.argv[5] ?? ""];
  if (permission === undefined) throw new Error("permission must be revoke, add, remove or remove-to-owner; ALMM permissions include principal rights");
  const c = await almm(process.argv[2]);
  const plan = await c.sdk.planUpdatePositionDelegatePermission({ tokenId: natural(process.argv[3], "tokenId"), delegate: address("ALMM_DELEGATE", process.argv[4]), permission, caller: c.caller });
  await execute("set ALMM position delegate", c, plan.transaction);
});
