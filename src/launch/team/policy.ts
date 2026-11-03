import { assertAmmoraV4Config, buildCreateAmmoraV4Config, type AmmoraV4ConfigSnapshot } from "@ammora-protocol/sdk";
import { encodeAbiParameters, getAddress, isAddress, keccak256, zeroAddress, type Address, type Hex } from "viem";
import { deriveConfigFromTemplate } from "../config-from-template.js";

export type TeamRecipientPolicy = {
  schemaVersion: 1;
  chainId: number;
  registry: Address;
  templateId: string;
  templateHash: Hex;
  configOwner: Address;
  partnerRecipient: Address;
  liquidityPartner: Address;
  leftoverReceiver: Address;
};

/** Explicit identities for a NEW Config. This never edits an existing Config. */
export const parseTeamRecipientPolicy = (input: unknown): TeamRecipientPolicy => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("recipient policy must be an object");
  const value = input as Record<string, unknown>;
  const fields = ["schemaVersion", "chainId", "registry", "templateId", "templateHash", "configOwner", "partnerRecipient", "liquidityPartner", "leftoverReceiver"];
  if (Object.keys(value).length !== fields.length || fields.some(field => !(field in value))) {
    throw new Error(`recipient policy requires exactly: ${fields.join(", ")}; fee/LP-ratio overrides are not supported`);
  }
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.chainId) || Number(value.chainId) <= 0) throw new Error("unsupported schemaVersion or chainId");
  if (typeof value.templateId !== "string" || !/^[1-9]\d*$/.test(value.templateId)) throw new Error("templateId must be a positive integer string");
  if (typeof value.templateHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value.templateHash)) throw new Error("templateHash must be bytes32");
  const recipient = (field: string): Address => {
    const candidate = value[field];
    if (typeof candidate !== "string" || !isAddress(candidate, { strict: true }) || candidate.toLowerCase() === zeroAddress) {
      throw new Error(`${field} must be a nonzero address with a valid checksum (or all lowercase)`);
    }
    return getAddress(candidate);
  };
  return {
    schemaVersion: 1, chainId: Number(value.chainId), registry: recipient("registry"),
    templateId: value.templateId, templateHash: value.templateHash as Hex,
    configOwner: recipient("configOwner"), partnerRecipient: recipient("partnerRecipient"),
    liquidityPartner: recipient("liquidityPartner"), leftoverReceiver: recipient("leftoverReceiver"),
  };
};

export const planTeamConfig = (
  template: AmmoraV4ConfigSnapshot,
  policy: TeamRecipientPolicy,
  target: { chainId: number; registry: Address },
  saleSupply: bigint,
  quoteThreshold: bigint,
) => {
  if (target.chainId !== policy.chainId || target.registry.toLowerCase() !== policy.registry.toLowerCase()) throw new Error("recipient policy chain/registry does not match the selected deployment");
  if (template.configId !== BigInt(policy.templateId) || template.configHash.toLowerCase() !== policy.templateHash.toLowerCase()) throw new Error("template identity/hash does not match the reviewed recipient policy");
  if (!template.enabled) throw new Error("template Config is disabled");
  const derived = deriveConfigFromTemplate(template, saleSupply, quoteThreshold);
  const config = {
    ...derived.config,
    partnerRecipient: policy.partnerRecipient,
    leftoverReceiver: policy.leftoverReceiver,
    liquidityDistribution: { ...derived.config.liquidityDistribution, partner: policy.liquidityPartner },
  };
  assertAmmoraV4Config(config, derived.curve);
  const transaction = { to: policy.registry, ...buildCreateAmmoraV4Config(config, derived.curve, policy.configOwner) };
  // Bind the review to chain, target, value and exact calldata; a changed recipient,
  // supply, threshold, template or owner requires another preview.
  const reviewHash = keccak256(encodeAbiParameters(
    [{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [BigInt(policy.chainId), transaction.to, 0n, transaction.data],
  ));
  return { ...derived, config, transaction, reviewHash, recipients: {
    configOwner: policy.configOwner,
    partnerRecipient: { inherited: template.config.partnerRecipient, selected: config.partnerRecipient },
    liquidityPartner: { inherited: template.config.liquidityDistribution.partner, selected: config.liquidityDistribution.partner },
    leftoverReceiver: { inherited: template.config.leftoverReceiver, selected: config.leftoverReceiver },
    creator: "Chosen by the separate token-creation flow; Config owner does not become every token's creator.",
    protocol: "Fixed by the deployment fee policy; this file cannot redirect protocol fees.",
  } };
};

export const assertTeamConfigReview = (expected: string | undefined, actual: Hex): void => {
  if (!expected || expected.toLowerCase() !== actual.toLowerCase()) throw new Error("reviewHash mismatch: run preview, review its complete Config/recipients, then supply that reviewHash to create");
};
