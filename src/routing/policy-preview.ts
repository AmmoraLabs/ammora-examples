import {
  DEFAULT_RISK_POLICY, resolveAmmoraAggregationRiskPolicy, ammoraNewPoolBlockWindow,
  isAmmoraBuiltInRouteModel, isAmmoraExternalVenueRouteModel, isAmmoraProtocolRouteModel,
  ammoraRouteModelVenueLabel,
} from "@ammora-protocol/sdk";
import { integer } from "../shared/input.js";

/** Offline UI policy preview. This never changes a live route client's policy. */
export const previewRoutingPolicy = (windowArg: string, blockTimeArg: string, model: string) => {
  if (!/^\d+$/.test(windowArg)) throw new Error("newPoolWindowSeconds must be a non-negative integer in seconds");
  const blockTimeSeconds = integer(blockTimeArg, "blockTimeSeconds", 1, 3600);
  if (!isAmmoraBuiltInRouteModel(model) && !isAmmoraExternalVenueRouteModel(model)) throw new Error("model must be a built-in route model or a valid venue:<slug>");
  // Partial overrides retain all other SDK defaults. Do not copy a dated whole policy.
  const overrides = { newPoolWindowSeconds: BigInt(windowArg) };
  const effectivePolicy = resolveAmmoraAggregationRiskPolicy(overrides);
  return {
    model, venueLabel: ammoraRouteModelVenueLabel(model),
    family: isAmmoraProtocolRouteModel(model) ? "protocol" : isAmmoraExternalVenueRouteModel(model) ? "external-venue" : "other-built-in",
    defaults: DEFAULT_RISK_POLICY, overrides, effectivePolicy, blockTimeSeconds,
    newPoolWindowBlocks: ammoraNewPoolBlockWindow(effectivePolicy, blockTimeSeconds),
    note: "Offline preview only. venue:<slug> is a name, not admission. A live venue needs a reviewed descriptor, declared provider binding, verified bytecode/wiring, registry admission and fresh state. No deployment or live policy was changed.",
  };
};
