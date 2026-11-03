import { normalizeArlV5Deployment, type ArlV5Deployment } from "@ammora-protocol/sdk";

/** JSON has no bigint: convert only the declared block field before SDK validation. */
export const parseV5Manifest = (text: string): ArlV5Deployment => {
  const raw = JSON.parse(text, (key: string, value: unknown) => {
    if (key !== "startBlock") return value;
    if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) return BigInt(value);
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
    throw new Error("V5 startBlock must be a non-negative decimal string or safe integer");
  }) as ArlV5Deployment;
  return normalizeArlV5Deployment(raw);
};
