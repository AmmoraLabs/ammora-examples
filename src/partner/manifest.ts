import type { PartnerGraduationDeployment } from "@ammora-protocol/sdk";

/** JSON encodes bigint block coordinates as decimal strings; the SDK still validates every pin. */
export const parsePartnerManifest = (text: string): PartnerGraduationDeployment => JSON.parse(text, (key: string, value: unknown) => {
  if (key !== "startBlock") return value;
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  throw new Error("Partner startBlock must be a non-negative decimal string or safe integer");
}) as PartnerGraduationDeployment;
