import { assertAmmoraV4Config, buildSingleSegmentCurve, maxBaseOutput, type AmmoraV4ConfigSnapshot } from "@ammora-protocol/sdk";
import { deriveConfigFromTemplate } from "./config-from-template.js";

/** Compounding and concentrated destinations use different coupled reserve math.
 * Recipient and initial LP-lock policy stay with the reviewed template.
 * The compounding branch explicitly selects its destination fee/curve settings.
 * This creates a document for review; it does not register or launch anything. */
export const authorLaunchConfig = (template: Pick<AmmoraV4ConfigSnapshot, "config">, saleSupply: bigint, quoteThreshold: bigint, mode: "concentrated" | "compounding") => {
  if (mode === "concentrated") return deriveConfigFromTemplate(template, saleSupply, quoteThreshold);
  if (saleSupply <= 0n || quoteThreshold <= 0n) throw new Error("Supply/threshold must be positive");
  const source = template.config;
  const curve = buildSingleSegmentCurve(source.startSqrtPrice, saleSupply, quoteThreshold);
  const price = curve[curve.length - 1]!.upperSqrtPrice;
  const availableQuote = quoteThreshold - quoteThreshold * BigInt(source.migrationQuoteFeeBps) / 10000n;
  // Registry V4 validates GROSS reserves; the adapter applies the fixed protocol
  // migration fee. Do not use a legacy net-reserve sizing helper here.
  const liquidity = availableQuote * (1n << 128n) / price;
  const base = (liquidity + price - 1n) / price;
  const v = source.lockedBaseVesting;
  const config = { ...source, migrationMode: 1, migrationQuoteThreshold: quoteThreshold,
    migrationBaseThreshold: base, postMigrationLiquidity: liquidity,
    postMigrationSqrtMinPrice: 0n, postMigrationSqrtMaxPrice: 0n,
    postMigrationCompoundingFeeBps: 5000, postMigrationFeeSchedulerMode: 0,
    postMigrationFeeNumberOfPeriods: 0, postMigrationFeePeriodFrequency: 0,
    postMigrationFeeReductionFactorBps: 0,
    totalSupply: maxBaseOutput(curve, source.startSqrtPrice) + base + v.cliffUnlockAmount + v.amountPerPeriod * BigInt(v.numberOfPeriods) };
  assertAmmoraV4Config(config, curve);
  return { config, curve, economics: { saleAllocationRaw: maxBaseOutput(curve, source.startSqrtPrice), grossMigrationBaseRaw: base, grossMigrationQuoteRaw: (liquidity * price + (1n << 128n) - 1n) / (1n << 128n), totalSupplyRaw: config.totalSupply } };
};
