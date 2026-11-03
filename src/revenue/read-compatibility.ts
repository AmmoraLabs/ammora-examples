import { parseAbi, type PublicClient } from "viem";

const creatorView = parseAbi(["function creator() view returns (address)"]);

/** SDK 0.3.1 RevenueCenter reads creator(), omitted from its published pool ABI.
 * Supplement this view on this reader only. SDK provenance/treasury rules and all
 * transaction planning remain unchanged; never mutate the installed SDK ABI.
 */
export const withRevenueReadCompatibility = (client: PublicClient): PublicClient => {
  const original = client.readContract;
  const read = (parameters: Parameters<PublicClient["readContract"]>[0]) => {
    if (parameters.functionName === "creator"
      && !parameters.abi.some(item => typeof item === "object" && item !== null
        && "type" in item && item.type === "function" && "name" in item && item.name === "creator")) {
      return original({ ...parameters, abi: creatorView, functionName: "creator", args: [] });
    }
    return original(parameters);
  };
  // The viem decoder still determines the generic return type; only a missing view
  // declaration is added. This adapter never creates a trusted deployment context.
  return { ...client, readContract: read as PublicClient["readContract"] };
};
