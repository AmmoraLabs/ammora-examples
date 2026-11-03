/** Offline raw-unit allocation; merge config into an explicitly authored complete launch policy. */
import { readFileSync } from "node:fs";
import { allocation } from "./policy.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const [file, ...extra] = process.argv.slice(2);
  if (!file || extra.length) throw new Error("usage: <allocation.json>");
  const plan = allocation(JSON.parse(readFileSync(file, "utf8")));
  printJson({ mode: "OFFLINE", lockedBaseVesting: plan.config, lockedBaseRaw: plan.totalAmountRaw,
    durationSeconds: plan.durationSeconds, roundingRemainderRaw: plan.roundingRemainderRaw,
    startsAt: "Graduation transaction timestamp", note: "Reserve this amount in the full supply calculation; recipients and LP policy are not modified" });
});
