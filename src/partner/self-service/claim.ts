/** Prepare a fixed-beneficiary claim; a request is neither authority nor a verified payment. */
import { readFileSync } from "node:fs";
import type { Address } from "viem";
import { address, cli, required, loadSelfServiceProfile, type SelfServiceProfile } from "./context.js";
import { openSelfServiceModule, parseSelfServiceModulePin, type SelfServiceModulePin } from "./extension.js";
export function prepareSelfServiceClaim(profile: SelfServiceProfile, module: SelfServiceModulePin, asset: Address, beneficiary: Address) {
  const { client, stats } = openSelfServiceModule(profile, module);
  return { request: client.planClaim(module.address, address(asset), address(beneficiary)), stats: stats(), fixedBeneficiary: beneficiary, automaticSend: false, payoutVerified: false, authority: "The actual beneficiary must authorize and simulate this request. This is not an alternate payout address or LP delegation." };
}
cli(import.meta.url, () => prepareSelfServiceClaim(loadSelfServiceProfile(required(2, "profile.json")), parseSelfServiceModulePin(JSON.parse(readFileSync(required(3, "module-pin.json"), "utf8"))), address(required(4, "asset")), address(required(5, "beneficiary"))));
