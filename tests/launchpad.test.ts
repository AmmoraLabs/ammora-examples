import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveConfigFromTemplate } from "../src/launch/config-from-template.js";
import { assertAmmoraV4Config, concentratedAmountsForLiquidity, type AmmoraV4Config } from "@ammora-protocol/sdk";
import { classifyAmmoraV4ExactInputFill, type AmmoraV4LaunchCurveState } from "@ammora-protocol/sdk";
import { readCurveQuote } from "../src/launch/curve-quote.js";

const state = (status: number, block = 123n) => ({ status, asOfBlock: block }) as AmmoraV4LaunchCurveState;

test("V4 buy remainder is graduation; partial sells and terminal dust never opt into partial execution", () => {
  const boundary = classifyAmmoraV4ExactInputFill({ amountIn: 70n, amountOut: 50n, amountLeft: 30n }, false);
  assert.equal(boundary.kind, "graduation-boundary");
  assert.equal(boundary.requestedAmountIn, 100n);
  assert.equal(boundary.consumedAmountIn + boundary.refundableAmountIn, 100n);
  assert.equal(boundary.allowPartialFill, true);
  const sell = classifyAmmoraV4ExactInputFill({ amountIn: 70n, amountOut: 50n, amountLeft: 30n }, true);
  assert.equal(sell.kind, "partial");
  assert.equal(sell.allowPartialFill, false);
  const dust = classifyAmmoraV4ExactInputFill({ amountIn: 1n, amountOut: 0n, amountLeft: 99n }, false);
  assert.equal(dust.kind, "terminal-dust");
  assert.equal(dust.allowPartialFill, false);
  assert.equal(classifyAmmoraV4ExactInputFill({ amountIn: 100n, amountOut: 50n, amountLeft: 0n }, false).kind, "full");
  assert.throws(() => classifyAmmoraV4ExactInputFill({ amountIn: -1n, amountOut: 50n, amountLeft: 0n }, false));
});

test("curve UI reads state and quote at one block and exposes the SDK refund classification", async () => {
  const blocks: bigint[] = [];
  const result = await readCurveQuote({
    getStateAtBlock: async (block) => { blocks.push(block); return state(1, block); },
    quoteExactInputAtBlock: async (amount, sell, block) => {
      assert.equal(amount, 100n);
      assert.equal(sell, false);
      blocks.push(block);
      return { amountIn: 70n, amountOut: 50n, amountLeft: 30n, nextSqrtPrice: 1n, fee: 2n, asOfBlock: block };
    },
  }, 123n, { amountIn: 100n, baseForQuote: false });
  assert.deepEqual(blocks, [123n, 123n]);
  assert.equal(result.fill?.refundableAmountIn, 30n);
  assert.equal(result.fill?.kind, "graduation-boundary");
});

test("inactive curves are not quoted; stale snapshots and RPC failures remain errors", async () => {
  const unexpectedQuote = async (): Promise<never> => { throw new Error("inactive curve must not be quoted"); };
  for (const status of [0, 2, 3]) {
    const result = await readCurveQuote({ getStateAtBlock: async () => state(status), quoteExactInputAtBlock: unexpectedQuote }, 123n, { amountIn: 1n, baseForQuote: false });
    assert.equal(result.quote, null);
    assert.equal(result.fill, null);
  }
  await assert.rejects(readCurveQuote({ getStateAtBlock: async () => state(1, 122n), quoteExactInputAtBlock: unexpectedQuote }, 123n), /different block/);
  const failure = new Error("503 service unavailable");
  await assert.rejects(readCurveQuote({ getStateAtBlock: async () => { throw failure; }, quoteExactInputAtBlock: unexpectedQuote }, 123n), error => error === failure);
});

// This fixture is an offline qualification policy, never a recommended deployment preset.
test("Config authoring accounts for sale, Graduation reserves and locked vesting without changing policy", async () => {
  const text = await readFile(new URL("./fixtures/synthetic-concentrated-template.json", import.meta.url), "utf8");
  const original: AmmoraV4Config = JSON.parse(text, (_, value: unknown) => typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : value);
  const before = structuredClone(original);
  const sale = 800_000_000_000_000_000n;
  const { config, curve, economics } = deriveConfigFromTemplate({ config: original }, sale, 6_500_000_000_000_000_000n);
  assert.equal(config.totalSupply, sale + config.migrationBaseThreshold + 120n);
  const required = concentratedAmountsForLiquidity({ sqrtPriceX64: curve[0]!.upperSqrtPrice, sqrtMinPriceX64: config.postMigrationSqrtMinPrice, sqrtMaxPriceX64: config.postMigrationSqrtMaxPrice }, config.postMigrationLiquidity, true);
  assert.equal(config.migrationBaseThreshold, required.baseAmount);
  assert.equal(economics.grossMigrationQuoteRaw + economics.quoteSurplusToProtocolRaw + economics.migrationQuoteFeeRaw, config.migrationQuoteThreshold);
  assert.ok(economics.quoteSurplusToProtocolRaw >= 0n);
  const feeTemplate = { ...original, migrationQuoteFeeBps: 100 };
  const withFee = deriveConfigFromTemplate({ config: feeTemplate }, sale, 6_500_000_000_000_000_000n);
  assert.equal(withFee.economics.migrationQuoteFeeRaw, 65_000_000_000_000_000n);
  assert.doesNotThrow(() => assertAmmoraV4Config(withFee.config, withFee.curve));
  assert.deepEqual(config.lockedBaseVesting, original.lockedBaseVesting);
  assert.deepEqual(config.liquidityDistribution, original.liquidityDistribution);
  assert.equal(config.partnerRecipient, original.partnerRecipient);
  assert.equal(config.leftoverReceiver, original.leftoverReceiver);
  assert.deepEqual(original, before);
  assert.doesNotThrow(() => assertAmmoraV4Config(config, curve));
  assert.throws(() => assertAmmoraV4Config({ ...config, totalSupply: sale }, curve), /reserves, thresholds, and vesting/);
  assert.throws(() => deriveConfigFromTemplate({ config: original }, 1n, 1n));
});
