/** arl:prepare-single-side-pool -- <baseToken> <quoteToken> <base|quote> <amountRaw> <sqrtMinQ64> <sqrtMaxQ64> <salt32>. Read-only; no permanent-lock assumption. */
import { zeroAddress } from "viem";
import { DammV2Client } from "@ammora-protocol/sdk";
import { address, clientOptions, deployment, reader } from "../shared/env.js";
import { caller, natural } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const [base, quote, side, amount, minimum, maximum, salt] = process.argv.slice(2);
  if (side !== "base" && side !== "quote") throw new Error("tokenSide must be base or quote");
  if (!/^0x[0-9a-fA-F]{64}$/.test(salt ?? "")) throw new Error("salt must be 32 bytes");
  const client = await reader(), c = deployment().contracts.launch, block = await client.getBlock();
  // There is no pool yet. The factory and deployment source authenticate preparation.
  const sdk = new DammV2Client(client, zeroAddress, "concentrated", c.concentratedFactory, c.concentratedPositionManager, clientOptions());
  const plan = await sdk.preparePoolCreationSingleSide({ baseToken: address("BASE_TOKEN", base), quoteToken: address("QUOTE_TOKEN", quote), creator: caller(), feeBps: 100, sqrtMinPrice: natural(minimum, "sqrtMinQ64", true), sqrtMaxPrice: natural(maximum, "sqrtMaxQ64", true), activationType: 0, activationPoint: Number(block.timestamp), collectFeeMode: 0, userSalt: salt as `0x${string}`, tokenSide: side, tokenAmount: natural(amount, "amountRaw", true) });
  printJson({ plan, sendEnabled: false, tokenPolicyAndCreationPermissionVerified: false });
});
