import {
  AmmoraV4MigrationMode,
  buildSingleSegmentCurve,
  assertAmmoraV4Config,
  concentratedDepositQuote,
  type AmmoraV4Config,
  type AmmoraV4ConfigSnapshot,
  type AmmoraV4Segment,
} from "@ammora-protocol/sdk";

/**
 * Derives a complete, registry-valid Config from a reviewed template.
 *
 * A launch Config has dozens of coupled fields. Public integrations should expose
 * a small policy editor and derive the remaining values from a known template,
 * rather than asking users to type contract coordinates or copying a partial
 * object from a UI response.
 */
export const deriveConfigFromTemplate = (
  template: Pick<AmmoraV4ConfigSnapshot, "config">,
  saleSupply: bigint,
  migrationQuoteThreshold: bigint,
): {
  config: AmmoraV4Config;
  curve: readonly AmmoraV4Segment[];
  economics: {
    saleAllocationRaw: bigint; grossMigrationBaseRaw: bigint; grossMigrationQuoteRaw: bigint;
    migrationQuoteFeeRaw: bigint; quoteSurplusToProtocolRaw: bigint; lockedBaseRaw: bigint; totalSupplyRaw: bigint;
  };
} => {
  if (saleSupply <= 0n || migrationQuoteThreshold <= 0n) {
    throw new RangeError("sale supply and quote threshold must be positive");
  }

  if (template.config.migrationMode !== AmmoraV4MigrationMode.Concentrated) {
    throw new RangeError(
      "this beginner template helper currently supports concentrated graduation only; "
      + "use a reviewed compounding authoring policy instead of rewriting its coupled reserves",
    );
  }

  const curve = buildSingleSegmentCurve(
    template.config.startSqrtPrice,
    saleSupply,
    migrationQuoteThreshold,
  );
  const segment = curve[0];
  if (!segment) throw new Error("single-segment curve construction returned no segment");

  const range = {
    sqrtPriceX64: segment.upperSqrtPrice,
    sqrtMinPriceX64: segment.lowerSqrtPrice,
    sqrtMaxPriceX64: segment.upperSqrtPrice * 2n,
  };
  const quoteFee = migrationQuoteThreshold * BigInt(template.config.migrationQuoteFeeBps) / 10_000n;
  const quoteAfterFee = migrationQuoteThreshold - quoteFee;
  // Fund the destination from post-fee quote; its required gross base is a
  // coupled economic result, not the old template's independently copied budget.
  const destination = concentratedDepositQuote(range, { quoteAmount: quoteAfterFee });
  const vesting = template.config.lockedBaseVesting;
  const lockedBase = vesting.cliffUnlockAmount + vesting.amountPerPeriod * BigInt(vesting.numberOfPeriods);
  const config: AmmoraV4Config = {
    ...template.config,
    totalSupply: saleSupply + destination.baseAmount + lockedBase,
    migrationQuoteThreshold,
    migrationBaseThreshold: destination.baseAmount,
    postMigrationSqrtMinPrice: range.sqrtMinPriceX64,
    postMigrationSqrtMaxPrice: range.sqrtMaxPriceX64,
    postMigrationLiquidity: destination.liquidity,
  };
  assertAmmoraV4Config(config, curve);
  return { config, curve, economics: {
    saleAllocationRaw: saleSupply,
    grossMigrationBaseRaw: destination.baseAmount,
    grossMigrationQuoteRaw: destination.quoteAmount,
    migrationQuoteFeeRaw: quoteFee,
    quoteSurplusToProtocolRaw: quoteAfterFee - destination.quoteAmount,
    lockedBaseRaw: lockedBase,
    totalSupplyRaw: config.totalSupply,
  } };
};
