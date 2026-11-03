/** staking:stake -- <vault> <amountRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildStakeAStake, ammoraAStakeAbi } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildStakeAStake(natural(process.argv[3], "amountRaw", true)) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  const token = await c.client.readContract({ address: c.target, abi: ammoraAStakeAbi, functionName: "stakeToken", blockNumber: c.blockNumber });
  await execute("stake", c, transaction, [{ token, spender: c.target, amount: natural(process.argv[3], "amountRaw", true) }]);
});
