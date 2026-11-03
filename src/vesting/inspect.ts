import { context } from "./client.js";
import { addr } from "./policy.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const [lock, ...extra] = process.argv.slice(2);
  if (!lock || extra.length) throw new Error("usage: <lock>");
  const c = await context();
  printJson({ mode: "READ_ONLY", state: await c.locks.readAtBlock(addr(lock), c.block.number) });
});
