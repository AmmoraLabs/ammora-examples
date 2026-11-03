/** npm run portable:curve -- [path/to/economics.json] — offline, no deployment or wallet. */
import { readFile } from "node:fs/promises";
import { buildPortableCurve } from "@ammora-protocol/sdk";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";

import { parseEconomics } from "./economics.js";

main(async () => {
  const path = process.argv[2] ?? new URL("./fixtures/synthetic-9-6.json", import.meta.url);
  const report = buildPortableCurve(parseEconomics(await readFile(path, "utf8")));
  printJson({ qualification: "SYNTHETIC_OFFLINE_MATH_ONLY", report });
});
