/** dfs:create-json -- preview <sharing.json> OR create <sharing.json> <reviewHash> */
import { readFile } from "node:fs/promises";
import { DFSFactoryClient } from "@ammora-protocol/sdk";
import { clientOptions, deployment, reader } from "../shared/env.js";
import { caller, execute } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { planSharingPolicy } from "./sharing-policy.js";

main(async () => {
  const [mode, path, review, ...extra] = process.argv.slice(2);
  if (!path || !["preview", "create"].includes(mode ?? "") || extra.length || (mode === "preview" ? !!review : !review)) throw new Error("usage: preview <sharing.json> OR create <sharing.json> <reviewHash>");
  const result = planSharingPolicy(JSON.parse(await readFile(path, "utf8")));
  if (mode === "create" && review?.toLowerCase() !== result.reviewHash.toLowerCase()) throw new Error("reviewHash mismatch; preview the current sharing policy");
  const account = caller(), client = await reader(), factory = deployment().contracts.feeSharing.factory;
  if (client.chain?.id !== result.policy.chainId || factory.toLowerCase() !== result.policy.factory.toLowerCase() || account.toLowerCase() !== result.policy.owner.toLowerCase()) throw new Error("chain/factory/caller differs from sharing policy");
  const sdk = new DFSFactoryClient(client, factory, clientOptions());
  const preflight = await sdk.planCreateVault(result.policy);
  printJson({ mode, ...result, preflight });
  if (!preflight.ready || preflight.expectedSender.toLowerCase() !== account.toLowerCase()
    || preflight.transaction.to.toLowerCase() !== factory.toLowerCase() || preflight.transaction.data !== result.transaction.data) throw new Error("Vault creation preflight refused or differs from reviewed transaction");
  if (mode === "preview") return;
  // No signer is loaded by preview, even when AMMORA_SEND=1 is inherited.
  await execute("create reviewed multi-recipient vault", { client, caller: account, allowedTargets: [factory] }, preflight.transaction);
});
