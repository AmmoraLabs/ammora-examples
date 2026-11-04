/** Draft the published synthetic standard's configuration from a partner's own inputs. */
import { readFileSync } from "node:fs";
import type { ExtensionConfigV2 } from "@ammora-protocol/sdk/partner";
import type { Address, Hex } from "viem";
import { address, hash, cli, required, loadSelfServiceProfile, type SelfServiceProfile } from "./context.js";

const terms = JSON.parse(readFileSync(new URL("../../../fixtures/self-service-standard-terms.test.json", import.meta.url), "utf8"));
export interface SelfServiceTestConfigurationInput {
  templateId: Hex; source: Address; controller: Address; partner: Address;
  recipients: Address[]; weights: number[];
  consentHash: Hex; economicId: Hex; rightsEvidence: Hex;
  quote?: Address; base?: Address; market?: Address;
}

export function prepareSelfServiceTestConfiguration(profile: SelfServiceProfile, value: unknown) {
  if (!profile.testOnly || profile.chainId !== 91342 || !terms.testOnly || terms.chainId !== profile.chainId) throw new Error("Synthetic GIWA configuration only");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected partner configuration inputs");
  const input = value as Record<string, unknown>;
  const fields = ["templateId", "source", "controller", "partner", "recipients", "weights", "consentHash", "economicId", "rightsEvidence"];
  if (Object.keys(input).some(k => ![...fields, "quote", "base", "market"].includes(k)) || fields.some(k => !(k in input))) throw new Error("Use the explicit configuration input fields; no wallet secrets or executable values");
  const templateId = hash(input.templateId);
  const standard = terms.standards.find((s: { templateId: string }) => s.templateId.toLowerCase() === templateId.toLowerCase());
  if (!standard) throw new Error("Unknown bundled synthetic standard");
  const source = address(input.source), controller = address(input.controller), partner = address(input.partner), ammora = address(standard.ammoraReceiver);
  if (partner.toLowerCase() === ammora.toLowerCase()) throw new Error("Original partner must differ from the standard Ammora receiver");
  const quote = address(input.quote ?? terms.quote.address), base = address(input.base ?? terms.base.address), market = address(input.market ?? standard.market.address);
  if (quote.toLowerCase() === base.toLowerCase()) throw new Error("Distinct test assets required");
  if (!Array.isArray(input.recipients) || !Array.isArray(input.weights) || !input.recipients.length || input.recipients.length > 8 || input.recipients.length !== input.weights.length) throw new Error("Provide one to eight explicit holders and matching weights");
  const recipients = input.recipients.map(address), weights = input.weights;
  if (new Set(recipients.map(x => x.toLowerCase())).size !== recipients.length || !weights.every(w => Number.isSafeInteger(w) && Number(w) > 0 && Number(w) <= 10000) || weights.reduce((a, b) => a + Number(b), 0) !== 10000) throw new Error("Unique holders and positive integer weights totaling 10000 required");
  if (!recipients.some(x => x.toLowerCase() === partner.toLowerCase())) throw new Error("Keep the original partner among the initial rights holders");
  const configuration: ExtensionConfigV2 = {
    source: {
      source, sourceRuntimeHash: hash(standard.sourceRuntimeHash),
      driver: address(standard.driver.address), driverRuntimeHash: hash(standard.driver.runtimeHash),
      registry: profile.registry.address, registryRuntimeHash: profile.registry.runtimeHash,
      quoteToken: quote, quoteRuntimeHash: hash(terms.quote.runtimeHash),
      baseToken: base, baseRuntimeHash: hash(terms.base.runtimeHash),
      sourceOwner: controller, controller, ammora, partner,
      family: standard.family, maxFeeBps: standard.maxFeeBps,
      consentHash: hash(input.consentHash), economicId: hash(input.economicId),
      dependencies: [{ target: market, runtimeHash: hash(standard.market.runtimeHash) }],
    },
    recipients, weights: weights.map(Number), rightsEvidence: hash(input.rightsEvidence),
  };
  return { configuration, templateId, testOnly: true, automaticSend: false, eligibility: "PREPARED_ONLY: diagnose the exact live source and obtain every holder's actual consent" };
}

// Configuration JSON is plain input data, never a serialized executable SDK plan.
cli(import.meta.url, () => prepareSelfServiceTestConfiguration(loadSelfServiceProfile(required(2, "profile.json")), JSON.parse(readFileSync(required(3, "partner-input.json"), "utf8"))).configuration);
