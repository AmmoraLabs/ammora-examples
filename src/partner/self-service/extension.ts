/** Use a module pin from canonical factory evidence, never a remote executable plugin. */
import { createPartnerExtensionClientV2, type ExtensionPinV2 } from "@ammora-protocol/sdk/partner";
import { address, hash, type SelfServiceProfile } from "./context.js";
import { createAdmissionReadPort } from "./rpc.js";
export type SelfServiceModulePin = ExtensionPinV2 & { vault: ExtensionPinV2 };
export function parseSelfServiceModulePin(value: unknown): SelfServiceModulePin {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a reviewed module pin");
  const p = value as Record<string, unknown>, v = p.vault;
  if (Object.keys(p).sort().join() !== "address,runtimeHash,vault" || !v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join() !== "address,runtimeHash") throw new Error("Use exactly module address/runtimeHash and vault address/runtimeHash");
  const vault = v as Record<string, unknown>, moduleAddress = address(p.address), vaultAddress = address(vault.address);
  if (moduleAddress.toLowerCase() === vaultAddress.toLowerCase()) throw new Error("Module and vault must be distinct");
  return { address: moduleAddress, runtimeHash: hash(p.runtimeHash), vault: { address: vaultAddress, runtimeHash: hash(vault.runtimeHash) } };
}
export function openSelfServiceModule(profile: SelfServiceProfile, module: SelfServiceModulePin) {
  const checked = parseSelfServiceModulePin(module), port = createAdmissionReadPort(profile, { maximumLogicalReads: 512, maximumDispatches: 256 });
  return { client: createPartnerExtensionClientV2({ ...profile, ports: [checked] }, port.options), stats: port.stats };
}
