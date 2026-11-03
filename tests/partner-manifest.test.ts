import test from "node:test";
import assert from "node:assert/strict";
import { PartnerGraduationClient } from "@ammora-protocol/sdk";
import type { PublicClient } from "viem";
import { parsePartnerManifest } from "../src/partner/manifest.js";

const roles = ["registry", "adapter", "factory", "implementation", "controller", "vault", "sourceFactory", "verifier"];
const fixture = (startBlock: unknown) => JSON.stringify({ schemaVersion: 1, chainId: 91342,
  sourceVersion: `0x${"11".repeat(32)}`, destinationVersion: `0x${"22".repeat(32)}`,
  sourceReview: "reference-only", acceptsNewBindings: false, recognizedForExisting: true,
  contracts: Object.fromEntries(roles.map((role, i) => [role, { address: `0x${String(i+1).padStart(40,"0")}`, runtimeCodeHash: `0x${"33".repeat(32)}`, startBlock }])) });
test("Partner JSON coordinates satisfy the published SDK pin validator without upgrading source review", () => {
  const parsed = parsePartnerManifest(fixture("39518000"));
  assert.equal(parsed.contracts.factory.startBlock, 39518000n);
  assert.equal(parsed.sourceReview, "reference-only");
  assert.equal(parsed.acceptsNewBindings, false);
  // Constructor validation is local. No RPC, signing, fabricated verified context or trust override.
  assert.doesNotThrow(() => new PartnerGraduationClient({} as PublicClient, parsed));
  assert.equal(parsePartnerManifest(fixture(39518000)).contracts.registry.startBlock, 39518000n);
});
test("Partner JSON rejects ambiguous or unsafe block coordinates and leaves malformed pin rejection to SDK", () => {
  for (const value of ["01", "1e6", "-1", "1.5", null, -1, 9007199254740992]) assert.throws(() => parsePartnerManifest(fixture(value)));
  const invalid = JSON.parse(fixture("1")); invalid.contracts.registry.runtimeCodeHash="0x12";
  assert.throws(() => new PartnerGraduationClient({} as PublicClient, parsePartnerManifest(JSON.stringify(invalid))), /invalid partner contract pin/);
});
