/** npm run dfs:create -- <token> <base> <recipientA> <shareA> <recipientB> <shareB> <salt32>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { DFSFactoryClient } from "@ammora-protocol/sdk";
import { zeroAddress, type Hex } from "viem";
import { address, clientOptions, deployment, reader } from "../shared/env.js";
import { caller, natural, execute } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const account = caller();
  const salt = process.argv[8];
  if (!/^0x[0-9a-fA-F]{64}$/.test(salt ?? "")) throw new Error("salt32 must be 32 bytes");
  const recipients = [
    { recipient: address("RECIPIENT_A", process.argv[4]), share: natural(process.argv[5], "shareA", true) },
    { recipient: address("RECIPIENT_B", process.argv[6]), share: natural(process.argv[7], "shareB", true) },
  ];
  if (recipients[0]!.recipient === recipients[1]!.recipient || recipients.some(r => r.recipient === zeroAddress)) throw new Error("Use two distinct nonzero recipients");
  const client = await reader(), factory = deployment().contracts.feeSharing.factory;
  const sdk = new DFSFactoryClient(client, factory, clientOptions());
  const plan = await sdk.planCreateVault({ owner: account, token: address("TOKEN", process.argv[2]), base: address("BASE", process.argv[3]), recipients, userSalt: salt as Hex });
  printJson(plan);
  if (!plan.ready || plan.expectedSender.toLowerCase() !== account.toLowerCase()) throw new Error("Vault creation preflight refused");
  await execute("create new DFS vault", { client, caller: account, allowedTargets: [factory] }, plan.transaction);
});
