import { calculateAmmoraPortableGasBudget, defineAmmoraNativeAssetModel, type AmmoraNativeAssetModel } from "@ammora-protocol/sdk";

/** Feature probe of the installed SDK; never rewrites the manifest or fabricates a context. */
export const requirePortableLifecycleAsset = (model: AmmoraNativeAssetModel): void => {
  defineAmmoraNativeAssetModel(model);
  if (model.kind === "NATIVE_ONLY") throw new Error("Portable lifecycle requires a shared or wrapped ERC-20 quote asset");
  if (model.kind === "WRAPPED_ERC20") {
    try {
      // Deliberately unequal balances distinguish separated-balance support from a shared-balance cast.
      const budget = calculateAmmoraPortableGasBudget({ assetModel: model, nativeBalanceRaw: 2n,
        quoteBalanceRaw: 7n, estimatedGasCostNativeRaw: 1n, safetyMarginBps: 0n, nativeValueRaw: 0n });
      if (budget.maxQuoteSpendRaw !== 7n || budget.totalQuoteReserveRaw !== 0n) throw new Error("Unexpected wrapped budget");
    } catch {
      throw new Error("Installed SDK lacks separate ETH/WETH Portable planning. Install published SDK 0.3.4 as described in src/portable/README.md; do not relabel WETH or fabricate a verified context.");
    }
  }
};
