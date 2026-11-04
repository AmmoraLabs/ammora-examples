/** Synthetic fixture only: prepare a source owned by your own controller, never a broadcast. */
import { readFileSync } from "node:fs";
import { encodeDeployData, encodeFunctionData, keccak256, type Abi, type Address, type Hex } from "viem";
import { cli, required, address, loadSelfServiceProfile, type SelfServiceProfile } from "./context.js";
const bundle = JSON.parse(readFileSync(new URL("../../../fixtures/self-service-test-artifacts.json", import.meta.url), "utf8"));
// The fixture bundle is data, not a remote plugin or SDK replacement.
const artifact = (name: string) => bundle.artifacts[name] as { abi: Abi; bytecode: Hex; runtimeBytecode: Hex };
export function prepareSelfServiceTestSource(profile: SelfServiceProfile, input: { controller: Address; partner: Address; quote: Address; base: Address; market: Address; family: 0 | 1 }) {
  if (!profile.testOnly || (input.family !== 0 && input.family !== 1)) throw new Error("An isolated synthetic GIWA test profile is required");
  for (const value of [input.controller, input.partner, input.quote, input.base, input.market]) address(value);
  if (input.quote.toLowerCase() === input.base.toLowerCase()) throw new Error("Distinct test assets required");
  const a = artifact("StandardSourceFixture");
  return { testOnly: true, economicValue: false, runtimeHash: keccak256(a.runtimeBytecode), request: { account: input.controller, data: encodeDeployData({ abi: a.abi, bytecode: a.bytecode, args: [input.controller, input.partner, input.quote, input.base, input.market, input.family] }), value: 0n }, automaticSend: false };
}
/** Only for the bundle's openly mintable test-token addresses, after checking their runtime pins. */
export function prepareSelfServiceTestFunding(profile: SelfServiceProfile, input: { controller: Address; source: Address; quote: Address; base: Address; amountRaw: bigint }) {
  if (!profile.testOnly || input.amountRaw <= 0n || input.amountRaw > 1_000_000_000n) throw new Error("Bounded synthetic funding only");
  for (const value of [input.controller, input.source, input.quote, input.base]) address(value);
  const a = artifact("StandardTokenFixture");
  return { testOnly: true, tokenRuntimeHashRequired: keccak256(a.runtimeBytecode), economicValue: false, automaticSend: false, requests: [input.quote, input.base].flatMap(token => [input.source, input.controller].map(recipient => ({ account: input.controller, to: token, data: encodeFunctionData({ abi: a.abi, functionName: "mint", args: [recipient, input.amountRaw] }), value: 0n }))) };
}
cli(import.meta.url, () => prepareSelfServiceTestSource(loadSelfServiceProfile(required(2, "profile.json")), JSON.parse(readFileSync(required(3, "test-source-input.json"), "utf8"))));
