import { readFileSync } from "node:fs";
import { parseAmmoraTokenLockCreatedReceipt } from "@ammora-protocol/sdk";
import { caller } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { context, confirmedReceipt } from "./client.js";
import { createRequest, reviewHash } from "./policy.js";
import { submit } from "./submit.js";
main(async () => {
  const [file, expected, ...extra] = process.argv.slice(2);
  if (!file || extra.length) throw new Error("usage: <create.json> [reviewHash]");
  const request = createRequest(JSON.parse(readFileSync(file, "utf8"))), account = caller(), c = await context(true);
  const plan = await c.locks.planCreateAtBlock({ ...request, caller: account, blockNumber: c.block.number });
  printJson({ mode: "UNSIGNED_PREVIEW", plan, reviewHash: reviewHash(plan) });
  if (process.env.AMMORA_SEND !== "1") return;
  const hash = await submit(c.client, plan, expected);
  if (plan.status === "APPROVAL_REQUIRED") {
    printJson({ hash, status: "APPROVAL_CONFIRMED", replanRequired: true, lockCreated: false }); return;
  }
  const { receipt } = await confirmedReceipt(c.client, hash);
  const created = parseAmmoraTokenLockCreatedReceipt(receipt, plan);
  const state = await c.locks.readAtBlock(created.lock, receipt.blockNumber);
  printJson({ hash, created, state, note: "Funded creation reconciled; do not repeat this salt or transaction" });
});
