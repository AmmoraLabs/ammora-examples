import type { AmmoraV4ConfigSnapshot } from "@ammora-protocol/sdk";
import { keccak256, toHex, type Address, type Hex } from "viem";
import { planTeamConfig, type TeamRecipientPolicy } from "./policy.js";

export type TeamAtomicInput = {
  account: Address; saleSupplyRaw: bigint; quoteThresholdRaw: bigint;
  name: string; symbol: string; metadataURI: string;
  quoteRaw: bigint; minimumBaseRaw: bigint; maxFeePerGasWei: bigint; deadline: bigint;
};
export type TeamAtomicTarget = {
  chainId: number; registry: Address; factory: Address; firstBuyExecutor: Address;
};

/** Author a NEW Config for this partner; never redirect an existing Config. */
export const prepareTeamAtomicFirstBuy = (
  template: AmmoraV4ConfigSnapshot, policy: TeamRecipientPolicy,
  target: TeamAtomicTarget, input: TeamAtomicInput,
) => {
  if (input.account.toLowerCase() !== policy.configOwner.toLowerCase()) {
    throw new Error("Atomic caller must be configOwner; this caller is also Creator and first-buy payer/recipient");
  }
  const team = planTeamConfig(template, policy, target, input.saleSupplyRaw, input.quoteThresholdRaw);
  const parameters = {
    account: input.account, config: team.config, segments: team.curve,
    launch: { name: input.name, symbol: input.symbol, metadataURI: input.metadataURI,
      creatorMetadataURI: input.metadataURI, tokenDecimals: team.config.tokenDecimals },
    firstBuys: [{ includedQuoteAmountRaw: input.quoteRaw, minimumBaseAmountOutRaw: input.minimumBaseRaw,
      allowPartialFill: false, recipient: input.account }],
    deadline: input.deadline, allowancePolicy: "prepare-approval" as const,
    gas: { maxFeePerGasNativeRaw: input.maxFeePerGasWei, safetyMarginBps: 2000n },
  };
  // Stable across approval -> READY, but changes with identities, calldata inputs or gas/deadline.
  const reviewHash = keccak256(toHex(JSON.stringify({ schemaVersion: 1, target, policy, parameters },
    (_, value: unknown) => typeof value === "bigint" ? value.toString() : value)));
  return { parameters, reviewHash, economics: team.economics, roles: {
    configOwner: input.account, creator: input.account, firstBuyPayer: input.account,
    firstBuyRecipient: input.account, partnerRecipient: team.config.partnerRecipient,
    liquidityPartner: team.config.liquidityDistribution.partner, leftoverReceiver: team.config.leftoverReceiver,
  } };
};

export const assertAtomicReview = (expected: string | undefined, actual: Hex) => {
  if (!expected || expected.toLowerCase() !== actual.toLowerCase()) {
    throw new Error("Atomic reviewHash mismatch: preview and review the complete roles, Config, first buy and explicit deadline again");
  }
};
