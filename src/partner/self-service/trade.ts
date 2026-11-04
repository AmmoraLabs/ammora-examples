/** Read a live exact-input ERC20 quote; keep the returned client/plan together for your wallet. */
import { readFileSync } from "node:fs";
import type { ExtensionIntentV2 } from "@ammora-protocol/sdk/partner";
import { address, cli, required, loadSelfServiceProfile, type SelfServiceProfile } from "./context.js";
import { openSelfServiceModule, parseSelfServiceModulePin, type SelfServiceModulePin } from "./extension.js";
export function parseSelfServiceTradeInput(value: unknown): Omit<ExtensionIntentV2, "ports"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected explicit trade inputs");
  const p = value as Record<string, unknown>, fields = ["assetIn", "amountRaw", "minOutputRaw", "payer", "recipient", "refundTo", "executor", "nonce", "ttlSeconds"];
  if (Object.keys(p).sort().join() !== fields.sort().join()) throw new Error("Provide exact trade fields; no transaction override or wallet secret");
  const uint = (key: string, allowZero = false) => { const v = p[key]; if (typeof v !== "string" || !/^\d{1,78}$/.test(v)) throw new Error(`${key} must be a decimal integer string`); const n = BigInt(v); if ((!allowZero && n === 0n) || n >= 2n ** 256n) throw new Error(`${key} is outside the supported uint256 range`); return n; };
  const ttlSeconds = uint("ttlSeconds"); if (ttlSeconds > 300n) throw new Error("Use an explicit short TTL of at most300 seconds");
  return { assetIn: address(p.assetIn), amount: uint("amountRaw"), limit: uint("minOutputRaw"), payer: address(p.payer), recipient: address(p.recipient), refundTo: address(p.refundTo), executor: address(p.executor), nonce: uint("nonce", true), ttlSeconds, mode: "exact-input", nativeIn: false, nativeOut: false };
}
export async function quoteSelfServiceTrade(profile: SelfServiceProfile, module: SelfServiceModulePin, input: unknown) {
  const intent = parseSelfServiceTradeInput(input), { client, stats } = openSelfServiceModule(profile, module);
  const plan = await client.quote({ ...intent, ports: [module.address] });
  return { client, plan, stats };
}
cli(import.meta.url, async () => { const profile = loadSelfServiceProfile(required(2, "profile.json")), module = parseSelfServiceModulePin(JSON.parse(readFileSync(required(3, "module-pin.json"), "utf8"))), input = JSON.parse(readFileSync(required(4, "trade-input.json"), "utf8")); const { plan, stats } = await quoteSelfServiceTrade(profile, module, input); return { plan, stats: stats(), automaticSend: false, authority: "CLI output is a view. In an application retain the original returned client and genuine plan for sign/simulate; never reconstruct send authority from this JSON." }; });
