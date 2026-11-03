import type { PortableCurveInput } from "@ammora-protocol/sdk";

const bigintFields = new Set(["numerator", "denominator", "totalSupplyRaw", "saleAllocationRaw", "lockedBaseRaw", "raw", "migrationQuoteFeeBps", "baseBudgetRaw", "quoteBudgetRaw", "maxQuoteSurplusToProtocolRaw", "maxPriceErrorBps", "maxSaleDustRaw"]);

export const parseEconomics = (text: string): PortableCurveInput => JSON.parse(text, (key: string, value: unknown) => {
  if (!bigintFields.has(key)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`${key} must be a non-negative integer string`);
  return BigInt(value);
}) as PortableCurveInput;
