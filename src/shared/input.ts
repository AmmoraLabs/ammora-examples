import { parseUnits } from "viem";

export const integer = (value: string, label: string, minimum: number, maximum: number): number => {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
};

export const rawAmount = (value: string | undefined, label: string): bigint => {
  if (!value || !/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new Error(`${label} must be a positive raw-unit integer`);
  }
  return BigInt(value);
};

/** viem rounds excess fractional digits; examples must reject accidental rounding. */
export const tokenAmount = (value: string, decimals: number, allowZero = false): bigint => {
  if (!/^\d+(\.\d+)?$/.test(value) || (value.split(".")[1]?.length ?? 0) > decimals) {
    throw new Error(`amount must be a non-negative decimal with at most ${decimals} fractional digits`);
  }
  const parsed = parseUnits(value, decimals);
  if (!allowZero && parsed === 0n) throw new Error("amount must be positive");
  return parsed;
};

export const slippage = (): number => integer(process.env.AMMORA_SLIPPAGE_BPS ?? "50", "AMMORA_SLIPPAGE_BPS", 0, 9999);

export const printJson = (value: unknown): void => {
  console.log(JSON.stringify(value, (_, entry: unknown) => typeof entry === "bigint" ? entry.toString() : entry, 2));
};
