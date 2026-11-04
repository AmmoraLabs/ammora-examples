import { createPartnerExtensionClientV2, createPartnerStandardOnboardingV1, type ExtensionPinV2, type PartnerStandardProfileV1, type ProductReadOptions } from "@ammora-protocol/sdk/partner";
import { getAddress, type Hex } from "viem";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createAdmissionReadPort } from "./rpc.js";
export interface SelfServiceProfile extends PartnerStandardProfileV1 {
  schemaVersion: 1; label: string; testOnly: boolean; evidence: string;
  factory: ExtensionPinV2; router: ExtensionPinV2; wrapper: ExtensionPinV2;
}
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Expected a profile object"); return v as Record<string, unknown>; };
export const hash = (v: unknown): Hex => { if (typeof v !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(v) || /^0x0{64}$/.test(v)) throw new Error("Expected a nonzero 32-byte hash"); return v as Hex; };
export const address = (v: unknown) => { if (typeof v !== "string") throw new Error("Expected an address string"); const a = getAddress(v); if (/^0x0{40}$/.test(a)) throw new Error("Zero address is not a deployment"); return a; };
export function parseSelfServiceProfile(value: unknown): SelfServiceProfile {
  const p = object(value), allowed = ["schemaVersion", "label", "testOnly", "evidence", "chainId", "genesisHash", "admission", "registry", "factory", "router", "wrapper"];
  if (Object.keys(p).some(k => !allowed.includes(k)) || p.schemaVersion !== 1 || p.chainId !== 91342 || typeof p.testOnly !== "boolean" || typeof p.label !== "string" || !p.label || typeof p.evidence !== "string" || !p.evidence) throw new Error("Use a reviewed GIWA Sepolia profile with explicit test scope and evidence");
  const pin = (v: unknown): ExtensionPinV2 => { const x = object(v); if (Object.keys(x).sort().join() !== "address,runtimeHash") throw new Error("Pin requires exactly address/runtimeHash"); return { address: address(x.address), runtimeHash: hash(x.runtimeHash) }; };
  return { schemaVersion: 1, label: p.label, testOnly: p.testOnly, evidence: p.evidence, chainId: 91342, genesisHash: hash(p.genesisHash), admission: pin(p.admission), registry: pin(p.registry), factory: pin(p.factory), router: pin(p.router), wrapper: pin(p.wrapper) };
}
export const loadSelfServiceProfile = (file: string) => parseSelfServiceProfile(JSON.parse(readFileSync(file, "utf8")));
export function openSelfService(profile: SelfServiceProfile, read: ProductReadOptions) {
  return { admission: createPartnerStandardOnboardingV1(profile, read), extension: createPartnerExtensionClientV2({ chainId: profile.chainId, genesisHash: profile.genesisHash, registry: profile.registry, factory: profile.factory, router: profile.router, wrapper: profile.wrapper, ports: [] }, read) };
}
export function fromProfileFile(file: string) {
  const profile = loadSelfServiceProfile(file), port = createAdmissionReadPort(profile);
  return { profile, ...openSelfService(profile, port.options), stats: port.stats };
}
export function cli(url: string, run: () => unknown | Promise<unknown>) {
  if (!process.argv[1] || pathToFileURL(process.argv[1]).href !== url) return;
  void (async () => { if (process.env.AMMORA_SEND === "1") throw new Error("These commands read/prepare/reconcile only; signing belongs to your application wallet"); const result = await run(); console.log(JSON.stringify(result, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)); })().catch(e => { console.error(JSON.stringify({ status: "BLOCKED", reason: e instanceof Error ? e.message : "Operation failed", automaticSend: false })); process.exitCode = 1; });
}
export const required = (index: number, label: string) => { const v = process.argv[index]; if (!v) throw new Error(`Required: ${label}`); return v; };
export const stage = (v: string): 0 | 1 => { if (v !== "0" && v !== "1") throw new Error("Stage must be 0 (curve) or 1 (pool)"); return Number(v) as 0 | 1; };
