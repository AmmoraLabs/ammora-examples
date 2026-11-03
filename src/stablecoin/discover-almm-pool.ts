import { context } from "./context.js";
import { discoverAlmmMarket } from "./almm-market.js";
import { load, json } from "./manifest.js";
import { main } from "../shared/run.js";
main(async () => {
  const [manifest, request, ...extra] = process.argv.slice(2);
  if (!manifest || !request || extra.length) throw new Error("usage: <manifest.json> <ALMM-create-request.json>");
  const c = await context(manifest);
  console.log(json(await discoverAlmmMarket(c, load(request))));
});
