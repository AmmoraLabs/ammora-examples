/** launch:transfer-creator -- <curve> <newCreator>. Only before migration; future authority moves immediately. */
import { AmmoraV4LaunchCurveClient } from "@ammora-protocol/sdk";
import { address, reader, v4Deployment } from "../shared/env.js";
import { caller, execute } from "../shared/actions.js";
import { sameTransaction } from "../arl/optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const curve = address("CURVE", process.argv[2]), newCreator = address("NEW_CREATOR", process.argv[3]), account = caller(), client = await reader(), c = v4Deployment().contracts.launch;
  const sdk = new AmmoraV4LaunchCurveClient(client, curve, { launchFactory: c.factory, feePolicy: c.feePolicy });
  const checked = await sdk.planTransferCreator(account, newCreator);
  const transaction = sameTransaction(checked.transaction, sdk.buildTransferCreator(newCreator));
  await client.call({ ...transaction, account });
  await execute("transfer launch creator", { client, caller: account, allowedTargets: [curve] }, transaction);
});
