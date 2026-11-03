/** npm run dfs:state -- <vault>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { dfs } from "./context.js";
import { natural, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await dfs(process.argv[2]);
  printJson(await c.sdk.getState());
});
