import { previewAmmoraLaunchFeeDistribution, previewAmmoraGraduatedFeeDistribution, type AmmoraV4Config, type AmmoraV4ConfigSnapshot } from "@ammora-protocol/sdk";
import { type Address } from "viem";
import { parseConfigDocument } from "../config-document.js";
import { parseTeamRecipientPolicy, planTeamConfig, type TeamRecipientPolicy } from "./policy.js";

export type TeamFeePolicy = TeamRecipientPolicy & { creatorShareOfNonProtocolBps: number };

/** Separate opt-in schema: the existing recipient-only policy still preserves template fees. */
export const parseTeamFeePolicy = (input: unknown): TeamFeePolicy => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("fee policy must be an object");
  const { creatorShareOfNonProtocolBps: share, ...recipients } = input as Record<string, unknown>;
  if (typeof share !== "number" || !Number.isInteger(share) || share < 0 || share > 10000) throw new Error("creatorShareOfNonProtocolBps must be an integer from 0 to 10000");
  return { ...parseTeamRecipientPolicy(recipients), creatorShareOfNonProtocolBps: share };
};

/** Allocation of a FEE amount, not a swap's notional or a future income forecast. */
export const previewTeamFees = (config: AmmoraV4Config, totalFee = 10000n) => {
  if (totalFee < 0n) throw new Error("totalFee must be nonnegative");
  const lp = config.liquidityDistribution;
  const creatorUnlocked = 10000 - lp.partnerUnlockedBps - lp.partnerPermanentLockedBps
    - lp.creatorPermanentLockedBps - lp.partnerVesting.allocationBps - lp.creatorVesting.allocationBps;
  if (creatorUnlocked < 0) throw new Error("LP allocation exceeds 10000 BPS");
  return {
    unit: "raw units of the collected fee token; illustrative total fee, not trade amount",
    beforeGraduation: {
      withoutReferral: previewAmmoraLaunchFeeDistribution(totalFee, config.creatorShareOfNonProtocolBps, false),
      withReferral: previewAmmoraLaunchFeeDistribution(totalFee, config.creatorShareOfNonProtocolBps, true),
    },
    afterGraduation: {
      withoutReferral: previewAmmoraGraduatedFeeDistribution(totalFee, config.postMigrationCompoundingFeeBps, false),
      withReferral: previewAmmoraGraduatedFeeDistribution(totalFee, config.postMigrationCompoundingFeeBps, true),
      note: "No direct Creator/Partner split from creatorShareOfNonProtocolBps. Fees follow LP positions and reinvestment; allocation is not a guaranteed income percentage.",
    },
    initialLpAllocationBps: {
      partner: { recipient: lp.partner, unlocked: lp.partnerUnlockedBps, permanentLocked: lp.partnerPermanentLockedBps, vesting: lp.partnerVesting },
      creator: { recipient: "The separately selected launch creator", unlocked: creatorUnlocked, permanentLocked: lp.creatorPermanentLockedBps, vesting: lp.creatorVesting },
    },
    scope: "Trading fees only. Creation/migration fees, surplus and leftover assets are separate.",
  };
};

export const planTeamFeeConfig = (
  template: AmmoraV4ConfigSnapshot, policy: TeamFeePolicy,
  target: { chainId: number; registry: Address }, saleSupply: bigint, quoteThreshold: bigint,
) => {
  // Re-parse even programmatic inputs. Preserve the original template and every LP/vesting field.
  const checked = parseTeamFeePolicy(policy);
  const inherited = planTeamConfig(template, checked, target, saleSupply, quoteThreshold);
  const config = { ...inherited.config, creatorShareOfNonProtocolBps: checked.creatorShareOfNonProtocolBps };
  const document = JSON.parse(JSON.stringify({
    schemaVersion: 1, chainId: checked.chainId, registry: checked.registry, configOwner: checked.configOwner,
    config, segments: inherited.curve,
  }, (_, value) => typeof value === "bigint" ? value.toString() : value)) as Record<string, unknown>;
  // Existing full-config schema, SDK assertion and exact calldata review hash are the create boundary.
  const plan = parseConfigDocument(document);
  return { document, plan, recipients: inherited.recipients, economics: inherited.economics, distribution: previewTeamFees(plan.config) };
};
