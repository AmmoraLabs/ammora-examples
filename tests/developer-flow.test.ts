import test from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, parseAbi } from "viem";
import { readFile } from "node:fs/promises";
import { previewVenueMath } from "../src/venues/math-preview.js";
import { DEFAULT_RISK_POLICY } from "@ammora-protocol/sdk";
import { previewQuoteWrap } from "../src/launch/funding-plan.js";
import { previewRoutingPolicy } from "../src/routing/policy-preview.js";

const wrapped = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const input = { quoteToken: wrapped, wrappedNative: wrapped, quoteDecimals: 18, nativeDecimals: 18, nativeRouter: other, nativeBalance: 2n * 10n ** 18n, humanAmount: "0.001" };

test("funding preview encodes a wrap to the reviewed wrapped asset with exact human units, without approval or native router swap", () => {
  const plan = previewQuoteWrap(input);
  assert.equal(plan.amountRaw, 10n ** 15n);
  assert.equal(plan.transaction.to, wrapped);
  assert.equal(plan.transaction.value, 10n ** 15n);
  const decoded = decodeFunctionData({ abi: parseAbi(["function deposit() payable"]), data: plan.transaction.data });
  assert.equal(decoded.functionName, "deposit");
});

test("funding preview refuses a different quote asset, decimal mismatch, precision loss and gas-exhausting funding", () => {
  assert.throws(() => previewQuoteWrap({ ...input, quoteToken: other }), /not this deployment/);
  assert.throws(() => previewQuoteWrap({ ...input, quoteDecimals: 6 }), /decimal mismatch/);
  for (const humanAmount of ["2", "3", "0", "-1", "0.0000000000000000001"]) assert.throws(() => previewQuoteWrap({ ...input, humanAmount }));
});

test("0.3.0 route policy keeps unmodified defaults and rounds seconds to blocks without treating venue names as admission", () => {
  const preview = previewRoutingPolicy("11", "2", "venue:demo");
  assert.equal(preview.newPoolWindowBlocks, 6n);
  assert.equal(preview.effectivePolicy.minimumLiquidityUsdX18, DEFAULT_RISK_POLICY.minimumLiquidityUsdX18);
  assert.equal(preview.effectivePolicy.maximumPriceDeviationBps, DEFAULT_RISK_POLICY.maximumPriceDeviationBps);
  assert.equal(preview.effectivePolicy.newPoolLiquidityMultiplier, DEFAULT_RISK_POLICY.newPoolLiquidityMultiplier);
  assert.equal(preview.family, "external-venue");
  assert.equal(previewRoutingPolicy("11", "2", "dbc").family, "protocol");
  assert.equal(previewRoutingPolicy("11", "2", "uniswap-v4").family, "other-built-in");
  for (const model of ["venue:", "venue:UPPER", "custom"]) assert.throws(() => previewRoutingPolicy("11", "2", model));
  for (const seconds of ["-1", "NaN", "31536001"]) assert.throws(() => previewRoutingPolicy(seconds, "2", "dbc"));
  assert.throws(() => previewRoutingPolicy("11", "0", "dbc"));
});

// At price 1 with a 0.3% fee and L=1e18, constant-liquidity integer output is
// floor(L * 997000 / (L + 997000)) = 996999; no floating point is involved.
test("0.3.0 venue math keeps exact integer output and requires real tick spacing", async () => {
  const fixture = JSON.parse(await readFile(new URL("../src/venues/fixtures/synthetic-v3.json", import.meta.url), "utf8"));
  const result = previewVenueMath(fixture);
  assert.equal(result.quote.amountOut, 996999n);
  assert.equal(result.quote.liquidityAfter, 10n ** 18n);
  assert.throws(() => previewVenueMath({ ...fixture, tickSpacing: undefined }), /tickSpacing/);
  assert.throws(() => previewVenueMath({ ...fixture, tickSpacing: 0 }));
  assert.throws(() => previewVenueMath({ ...fixture, amountInRaw: "1e6" }));
  assert.throws(() => previewVenueMath({ ...fixture, kind: "LIVE" }), /SYNTHETIC_OFFLINE/);
});
