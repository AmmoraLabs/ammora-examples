/** npm run routing:policy -- [newPoolWindowSeconds=1036800] [blockTimeSeconds=2] [model=venue:demo] */
import { previewRoutingPolicy } from "./policy-preview.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";

main(async () => {
  const [window = "1036800", blockTime = "2", model = "venue:demo", ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error("usage: [newPoolWindowSeconds] [blockTimeSeconds] [model]");
  printJson(previewRoutingPolicy(window, blockTime, model));
});
