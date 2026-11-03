import { ammoraLaunchConfigRegistryV4Abi, assertAmmoraV4Config, buildCreateAmmoraV4Config, type AmmoraV4Config, type AmmoraV4Segment } from "@ammora-protocol/sdk";
import { encodeAbiParameters, getAddress, isAddress, keccak256, zeroAddress, type AbiParameter, type Address } from "viem";

const object = (value: unknown, names: readonly string[], label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== names.length || names.some(name => !(name in result))) throw new Error(`${label} requires exactly: ${names.join(", ")}`);
  return result;
};
// Use the published contract ABI for the complete schema. Large integers are JSON
// decimal strings; small ABI integers are safe numbers. Never round token amounts.
const parse = (parameter: AbiParameter, value: unknown, label: string): unknown => {
  if (parameter.type === "tuple[]" && "components" in parameter) {
    if (!Array.isArray(value) || !value.length) throw new Error(`${label} must be a nonempty array`);
    return value.map((item, i) => parse({ ...parameter, type: "tuple" }, item, `${label}[${i}]`));
  }
  if (parameter.type === "tuple" && "components" in parameter) {
    const input = object(value, parameter.components.map(p => p.name!), label);
    return Object.fromEntries(parameter.components.map(p => [p.name, parse(p, input[p.name!], `${label}.${p.name}`)]));
  }
  if (parameter.type === "address") {
    if (typeof value !== "string" || !isAddress(value, { strict: true })) throw new Error(`${label} must be an address`);
    return getAddress(value);
  }
  if (parameter.type === "bool") {
    if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
    return value;
  }
  const match = /^uint(\d+)$/.exec(parameter.type);
  if (!match) throw new Error(`Unsupported schema type ${parameter.type}`);
  const bits = Number(match[1]);
  if (bits <= 48) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || BigInt(value) >= 1n << BigInt(bits)) throw new Error(`${label} must be a uint${bits} number`);
    return value;
  }
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value) || BigInt(value) >= 1n << BigInt(bits)) throw new Error(`${label} must be a uint${bits} decimal string`);
  return BigInt(value);
};
export const parseConfigDocument = (value: unknown) => {
  const input = object(value, ["schemaVersion", "chainId", "registry", "configOwner", "config", "segments"], "document");
  if (input.schemaVersion !== 1 || typeof input.chainId !== "number" || !Number.isSafeInteger(input.chainId) || input.chainId <= 0) throw new Error("Invalid schemaVersion/chainId");
  const abi = ammoraLaunchConfigRegistryV4Abi.find(f => f.type === "function" && f.name === "createConfig")!;
  const config = parse(abi.inputs[0], input.config, "config") as AmmoraV4Config;
  const segments = parse(abi.inputs[1], input.segments, "segments") as readonly AmmoraV4Segment[];
  const configOwner = parse({ type: "address" }, input.configOwner, "configOwner") as Address;
  const registry = parse({ type: "address" }, input.registry, "registry") as Address;
  if (configOwner === zeroAddress || registry === zeroAddress) throw new Error("Owner/registry must be nonzero");
  assertAmmoraV4Config(config, segments);
  const transaction = { to: registry, ...buildCreateAmmoraV4Config(config, segments, configOwner) };
  const reviewHash = keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }], [BigInt(input.chainId), registry, 0n, transaction.data]));
  return { chainId: input.chainId, registry, configOwner, config, segments, transaction, reviewHash };
};
