import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as root from "@ammora-protocol/sdk";
import * as integrate from "@ammora-protocol/sdk/integrate";
import * as partner from "@ammora-protocol/sdk/partner";
import * as adapters from "@ammora-protocol/sdk/partner-adapters";

test("0.3.1 exposes existing and partner entrypoints while source-specific drivers stay in adapters", () => {
  assert.equal(typeof root.DammV2Client, "function");
  assert.equal(typeof root.buildClaimFeeVaultFor, "function");
  assert.equal(typeof integrate.buildAmmoraExactInCalldata, "function");
  assert.equal(typeof partner.createPartnerSdkCatalogV2, "function");
  assert.equal(typeof partner.createPoolRightsClientV1, "function");
  assert.equal(typeof adapters.createReviewedSetupDriver, "function");
  for (const name of ["C1_GIWAGMI_DRIVER_ABI", "POOL_RIGHTS_GIWAGMI_DRIVER_ABI"] as const) {
    assert.ok(Array.isArray(adapters[name]));
    assert.equal(name in partner, false);
  }
});

test("all four public SDK imports need neither a wallet nor network access", () => {
  const code = `globalThis.fetch = () => { throw new Error('NETWORK_FORBIDDEN'); };
    for (const module of ['@ammora-protocol/sdk','@ammora-protocol/sdk/integrate','@ammora-protocol/sdk/partner','@ammora-protocol/sdk/partner-adapters']) await import(module);`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    encoding: "utf8", timeout: 10000,
    env: { ...process.env, AMMORA_SEND: "0", AMMORA_PRIVATE_KEY: "", AMMORA_RPC_URL: "http://127.0.0.1:1" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /NETWORK_FORBIDDEN|ECONNREFUSED/);
});
