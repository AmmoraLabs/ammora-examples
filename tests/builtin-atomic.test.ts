import test from "node:test";
import assert from "node:assert/strict";
import { requireAtomicCatalogAPI } from "../src/launch/team/builtin-first-buy.js";
test("missing catalog feature refuses old SDK before any RPC/key", () => {
  for (const value of [null, {}, { createConfigAndPoolWithFirstBuy() {} }, {
    createConfigAndPoolWithFirstBuy() {}, giwaSepoliaAtomicLaunchDeployment: {},
    giwaSepoliaAtomicLaunchTargets: { firstBuyExecutor: null },
  }]) assert.throws(() => requireAtomicCatalogAPI(value), /requires SDK 0.3.7/);
});
test("catalog adapter preserves the exported function and catalog", () => {
  const module = { createConfigAndPoolWithFirstBuy() {}, giwaSepoliaAtomicLaunchDeployment: {},
    giwaSepoliaAtomicLaunchTargets: { firstBuyExecutor: "0x1a19a3b0e69b33db3a2f9b2487866b4be04dd451" } };
  assert.equal(requireAtomicCatalogAPI(module), module);
});
