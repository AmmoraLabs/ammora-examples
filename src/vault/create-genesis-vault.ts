import { tokenAmount } from "../shared/input.js";
/**
 * Sell a launch's first allocation before its pool opens, at one price for everyone.
 *
 *   npm run vault:genesis -- <poolAddress> <buyCap> <perWalletCap> [minutes]
 *
 * The problem a genesis vault solves is the first block. When a pool opens, whoever gets
 * in first pays the lowest price, and on a chain that means whoever pays the most for
 * ordering. Everyone else buys from them. A genesis vault takes that block off the table:
 * deposits are collected over a window while the pool is shut, and every depositor is
 * filled at the same price when it opens.
 *
 * ── The caps, and which one is the real one ───────────────────────────────────
 * `buyCap` is what the vault will actually spend into the pool. `perWalletCap`
 * limits one address. Deposits above the buy cap are not refused: they are
 * accepted and the excess is refunded pro rata, so nobody has to race to be
 * inside the cap either. Racing to deposit early would just recreate the problem
 * this exists to remove.
 *
 * ── Two phases and a wait ─────────────────────────────────────────────────────
 * Creating the vault binds it to a pool; configuring sets the window and the
 * caps. They are separate calls because the vault has to exist before it can be
 * addressed, and because an operator may want to create early and price late.
 *
 * After the window closes the authority fills and finalises, and only then can
 * depositors claim. `vault:genesis-deposit` covers the depositor's side.
 *
 * This example opens the window immediately and closes it after `minutes`, which
 * is what makes it runnable. A real launch announces the window in advance,
 * because a window nobody knew about is a private sale wearing a public one's
 * clothes.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import {
  DammV2Client,
  ammAGVaultAbi,
  ammoraV3AGVaultFactoryAbi,
} from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, explorerLink, reader, signer } from "../shared/env.js";
import { amount, asPool, main, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

/** How long the deposit window stays open. */
const DEFAULT_MINUTES = 10;

/** Pro-rata mode: everyone is filled at one price, and the excess comes back. */
const MODE_PRORATA = 0;

/** No whitelist. A merkle root would gate it to a named list instead. */
const WHITELIST_NONE = 0;

main(async () => {
  const [poolArgument, buyCapArgument, walletCapArgument, minutesArgument] = process.argv.slice(2);
  const pool = address("ARL_POOL", poolArgument);
  if (!buyCapArgument || !walletCapArgument) {
    throw new Error(
      "usage: npm run vault:genesis -- <poolAddress> <buyCap> <perWalletCap> [minutes]",
    );
  }
  const minutes = Number(minutesArgument ?? DEFAULT_MINUTES);
  if (!Number.isInteger(minutes) || minutes <= 0) throw new Error("minutes must be above 0");

  const { wallet, account } = signer();
  const client = await reader();
  const target = deployment();
  const vaults = target.contracts.vaults;
  if (!vaults) {
    throw new Error(
      `the ${target.slot} deployment has no vault factories;`
      + " set AMMORA_CHAIN_ID to a deployment that does",
    );
  }
  const factory = vaults.genesisFactory;
  await requireContract(client, "genesis vault factory", factory);
  await requireContract(client, "pool", pool);

  const contracts = target.contracts.launch;
  const sdk = new DammV2Client(
    client, pool, "concentrated", contracts.concentratedFactory, contracts.concentratedPositionManager, clientOptions(),
  );
  const state = await asPool(pool, "a concentrated pool", () => sdk.getPoolState());

  // The pool refuses to install a vault once it is trading, which is the whole logic of
  // the thing: a genesis vault sells the allocation before the pool opens, so there is no
  // first block to win. Checking here names that; the pool's own refusal is Unauthorized,
  // which reads as a permission problem and sends you looking in the wrong place.
  const active = await client.readContract({
    abi: [{ type: "function", name: "isActive", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] }] as const,
    address: pool,
    functionName: "isActive",
  }).catch(() => false) as boolean;
  if (active) {
    throw new Error(
      `pool ${pool} is already trading, and a genesis vault can only be installed before`
      + " that. Create the pool with AMMORA_ACTIVATION_DELAY_MINUTES set, then install"
      + " the vault while it is still shut",
    );
  }

  // Deposits are in the quote token, because that is what the vault spends into the pool.
  const quote = await tokenInfo(client, state.quoteToken);
  const maxBuyingCap = tokenAmount(buyCapArgument, quote.decimals);
  const individualDepositingCap = tokenAmount(walletCapArgument, quote.decimals, true);

  // The window has to close before the pool opens, and the vault checks that against the
  // pool's own activation point rather than taking the caller's word for it.
  const activationPoint = Number(await client.readContract({
    abi: [{ type: "function", name: "activationPoint", stateMutability: "view", inputs: [], outputs: [{ type: "uint40" }] }] as const,
    address: pool,
    functionName: "activationPoint",
  }));
  const planningBlock = await client.getBlock({ blockTag: "latest" });
  const now = Number(planningBlock.timestamp);
  // The window opens a little ahead, not now. The vault checks the start point against
  // the block time when `configure` lands, and by then "now" is already the past, so a
  // window that starts at build time is rejected for having started before it was set.
  const depositingStartPoint = now + 180;
  const depositingEndPoint = Math.min(now + 180 + minutes * 60, activationPoint - 1);
  if (depositingEndPoint <= depositingStartPoint) {
    throw new Error(
      `pool ${pool} opens at ${activationPoint}, which leaves no window to collect deposits in.`
      + " Create the pool further ahead with AMMORA_ACTIVATION_DELAY_MINUTES",
    );
  }

  console.log(`factory     ${factory}`);
  console.log(`pool        ${pool}`);
  console.log(`buy cap     ${amount(maxBuyingCap, quote.decimals, quote.symbol)}`);
  console.log(`per wallet  ${amount(individualDepositingCap, quote.decimals, quote.symbol)}`);
  console.log(`window      opens in 3 min, closes at ${depositingEndPoint} (pool opens ${activationPoint})`);
  console.log("");

  const { request, result } = await client.simulateContract({
    abi: ammoraV3AGVaultFactoryAbi,
    account,
    address: factory,
    functionName: "createVault",
    args: [pool, account.address, `0x${"00".repeat(32)}` as const],
  });
  // Both, because the second one is what `configure` wants. The factory installs an
  // adapter on the pool and the vault talks to that adapter as though it were the
  // protocol: it answers `lifecycle` and `activationType` for itself and rejects being
  // asked about anything else. So the `pool` field below is the adapter, not the pool,
  // and passing the pool there is refused as InvalidConfiguration without saying which
  // of nine conditions failed.
  const [vault, adapter] = result as readonly [Address, Address];

  const hash = await wallet.writeContract(request);
  const created = await client.waitForTransactionReceipt({ hash });
  if (created.status !== "success") throw new Error(`creation reverted: ${explorerLink(hash)}`);
  console.log(`  createVault: ${explorerLink(hash)}`);

  const configure = {
    to: vault,
    data: (await import("viem")).encodeFunctionData({
      abi: ammAGVaultAbi,
      functionName: "configure",
      args: [{
        pool: adapter,
        mode: MODE_PRORATA,
        whitelistMode: WHITELIST_NONE,
        depositingStartPoint,
        depositingEndPoint,
        // No vesting: depositors take their fill as soon as it is finalised. A launch
        // that wants to slow the first sellers down sets a vesting window here instead.
        // Vesting cannot start before the pool does, so the earliest it can be is the
        // moment trading opens. Equal points mean no vesting: depositors take their fill
        // as soon as it is finalised. A launch that wants to slow the first sellers down
        // moves the end point out.
        vestingStartPoint: activationPoint,
        vestingEndPoint: activationPoint,
        maxBuyingCap,
        // Zero, and it has to be: pro-rata mode rejects a deposit cap outright. Deposits
        // are unbounded on purpose and the excess over the buy cap is refunded pro rata,
        // so being early is worth nothing. A cap here would put the race back.
        maxDepositingCap: 0n,
        individualDepositingCap,
        entryFee: 0n,
        merkleRoot: `0x${"00".repeat(32)}` as const,
      }],
    }),
  };

  await preflight(
    client,
    account,
    configure,
    ammAGVaultAbi,
    "configure vault",
    created.blockNumber,
  );
  await send("configure", configure, wallet, account, client);

  console.log(`\nvault is live at ${vault}`);
  console.log(`deposit into it with: npm run vault:genesis-deposit -- ${vault} <amount>`);
});
