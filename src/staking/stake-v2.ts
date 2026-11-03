/** staking:stake-v2 -- <vaultV2> <amountRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildStakeAStakeV2, ammoraAStakeV2Abi } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildStakeAStakeV2(natural(process.argv[3], "amountRaw", true)) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  const token = await c.client.readContract({ address: c.target, abi: ammoraAStakeV2Abi, functionName: "stakeToken", blockNumber: c.blockNumber });
  await execute("stake-v2", c, transaction, [{ token, spender: c.target, amount: natural(process.argv[3], "amountRaw", true) }]);
});
