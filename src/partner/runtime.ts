import { pathToFileURL } from "node:url";
import { printJson } from "../shared/input.js";
import { getPartnerSdkGuidanceV2 } from "@ammora-protocol/sdk/partner";

export const isMain = (url: string) => process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === url;
export const runOffline = async (task: () => unknown | Promise<unknown>) => {
  if (process.env.AMMORA_SEND === "1") {
    console.error("Partner examples are offline/read-only; unset AMMORA_SEND");
    process.exitCode = 1;
    return;
  }
  try {
    printJson(await task());
  } catch (error) {
    // SDK guidance sanitizes provider failures. No raw RPC text or signed data is logged.
    console.error(getPartnerSdkGuidanceV2(error, { phase: "plan", submission: "not-submitted" }).message);
    process.exitCode = 1;
  }
};
