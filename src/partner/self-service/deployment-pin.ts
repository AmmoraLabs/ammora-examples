/** Derive child pins from a trusted factory's canonical deployment, using public RPC only. */
import { readFileSync } from "node:fs";
import { createPublicClient, http, keccak256, parseEventLogs, type PublicClient } from "viem";
import { EXTENSION_FACTORY_ABI, EXTENSION_VAULT_ABI } from "@ammora-protocol/sdk/partner";
import { address, hash, cli, required, loadSelfServiceProfile, type SelfServiceProfile } from "./context.js";
import { parseSelfServiceModulePin } from "./extension.js";
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const requireThat = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };
export async function readSelfServiceDeploymentPin(profile: SelfServiceProfile, client: PublicClient, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected known deployment identities");
  const p = input as Record<string, unknown>;
  if (Object.keys(p).sort().join() !== "configurationHash,module,transactionHash,vault") throw new Error("Only transactionHash/configurationHash/module/vault are accepted; this is receipt-only authority");
  const transactionHash = hash(p.transactionHash), configurationHash = hash(p.configurationHash), module = address(p.module), vault = address(p.vault);
  requireThat(await client.getChainId() === profile.chainId, "Wrong chain");
  requireThat(same((await client.getBlock({ blockNumber: 0n })).hash, profile.genesisHash), "Wrong genesis");
  const receipt = await client.getTransactionReceipt({ hash: transactionHash });
  requireThat(same(receipt.transactionHash, transactionHash), "Receipt does not match the known hash");
  requireThat(receipt.status === "success" && !receipt.logs.some(l => l.removed), "Not a successful observed deployment; reconcile this known hash, never automatically resend");
  requireThat(same((await client.getBlock({ blockNumber: receipt.blockNumber })).hash, receipt.blockHash), "Receipt is not canonical");
  requireThat((await client.getBlock()).number >= receipt.blockNumber + 12n, "Need13 observed confirmations; wait without resending");
  const factoryCode = await client.getBytecode({ address: profile.factory.address, blockNumber: receipt.blockNumber });
  requireThat(factoryCode && same(keccak256(factoryCode), profile.factory.runtimeHash), "Untrusted factory runtime");
  const created = parseEventLogs({ abi: EXTENSION_FACTORY_ABI, eventName: "Created", logs: receipt.logs, strict: true }).filter(e => same(e.address, profile.factory.address));
  const event = created[0]; if (created.length !== 1 || !event) throw new Error("Expected exactly one trusted factory Created event");
  requireThat(same(event.args.configurationHash, configurationHash) && same(event.args.module, module) && same(event.args.vault, vault), "Created identities differ from your known plan");
  const recorded = await client.readContract({ address: profile.factory.address, abi: EXTENSION_FACTORY_ABI, functionName: "deployment", args: [configurationHash], blockNumber: receipt.blockNumber });
  const moduleCode = await client.getBytecode({ address: module, blockNumber: receipt.blockNumber }), vaultCode = await client.getBytecode({ address: vault, blockNumber: receipt.blockNumber });
  if (!moduleCode || !vaultCode || moduleCode === "0x" || vaultCode === "0x") throw new Error("Missing child runtime");
  const moduleHash = keccak256(moduleCode), vaultHash = keccak256(vaultCode);
  requireThat(same(recorded[0], module) && same(recorded[1], moduleHash) && same(event.args.runtimeHash, moduleHash), "Factory mapping/event/runtime disagree");
  requireThat(same(await client.readContract({ address: vault, abi: EXTENSION_VAULT_ABI, functionName: "creditor", blockNumber: receipt.blockNumber }), module), "Vault creditor is not the created module");
  requireThat(same((await client.getBlock({ blockNumber: receipt.blockNumber })).hash, receipt.blockHash), "Canonical block changed during verification");
  return { pin: parseSelfServiceModulePin({ address: module, runtimeHash: moduleHash, vault: { address: vault, runtimeHash: vaultHash } }), transactionHash, configurationHash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, observedConfirmationsAtLeast: 13, finalizedStatusClaimed: false, automaticSend: false, activationOrPayoutVerified: false };
}
cli(import.meta.url, async () => {
  const profile = loadSelfServiceProfile(required(2, "profile.json")), input = JSON.parse(readFileSync(required(3, "known-deployment.json"), "utf8"));
  const client = createPublicClient({ cacheTime: 0, transport: http("https://sepolia-rpc.giwa.io", { retryCount: 0, timeout: 30000 }) });
  return (await readSelfServiceDeploymentPin(profile, client, input)).pin;
});
