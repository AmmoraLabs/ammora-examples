/** npm run venues:quote-math -- [synthetic-fixture.json] */
import { readFile } from "node:fs/promises";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { previewVenueMath } from "./math-preview.js";

main(async () => {
  const [path, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error("usage: [synthetic-fixture.json]");
  const input = await readFile(path ?? new URL("./fixtures/synthetic-v3.json", import.meta.url), "utf8");
  printJson(previewVenueMath(JSON.parse(input)));
});
