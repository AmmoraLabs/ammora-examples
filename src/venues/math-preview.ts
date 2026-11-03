import { quoteUniswapV3ExactIn, type UniswapV3QuoteState } from "@ammora-protocol/sdk";

/** Synthetic math fixture only. Live providers must authenticate and read their whole tick window at one block. */
export const previewVenueMath = (input: unknown) => {
  if (!input || typeof input !== "object") throw new Error("expected a synthetic quote fixture");
  const value = input as Record<string, unknown>;
  if (value.kind !== "SYNTHETIC_OFFLINE") throw new Error("this command accepts SYNTHETIC_OFFLINE fixtures only");
  const raw = (value: unknown, label: string): bigint => {
    if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`${label} must be a raw integer string`);
    return BigInt(value);
  };
  const number = (value: unknown, label: string): number => {
    if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${label} must be an integer number`);
    return value;
  };
  if (typeof value.zeroForOne !== "boolean" || !Array.isArray(value.initializedTicks)) throw new Error("zeroForOne and initializedTicks are required");
  const state: UniswapV3QuoteState = {
    sqrtPriceX96: raw(value.sqrtPriceX96, "sqrtPriceX96"), liquidity: raw(value.liquidity, "liquidity"),
    tick: number(value.tick, "tick"), feePips: number(value.feePips, "feePips"),
    // Required since math/SDK 0.3.0; never guess spacing from fee tier.
    tickSpacing: number(value.tickSpacing, "tickSpacing"),
    initializedTicks: value.initializedTicks.map((entry: unknown) => {
      if (!entry || typeof entry !== "object") throw new Error("invalid initialized tick");
      const row = entry as Record<string, unknown>;
      if (typeof row.liquidityNet !== "string" || !/^-?\d+$/.test(row.liquidityNet)) throw new Error("liquidityNet must be an integer string");
      return { tick: number(row.tick, "initialized tick"), liquidityNet: BigInt(row.liquidityNet) };
    }),
  };
  const amountIn = raw(value.amountInRaw, "amountInRaw");
  if (amountIn === 0n) throw new Error("amountInRaw must be positive");
  return { kind: value.kind, state, amountInRaw: amountIn, zeroForOne: value.zeroForOne,
    quote: quoteUniswapV3ExactIn(state, amountIn, value.zeroForOne),
    note: "Offline integer math; not a live pool quote or executable route. Tick window, price limits and liquidity must be freshly read by a verified provider. This grants no Uniswap V4 venue admission and encodes no transaction.",
  };
};
