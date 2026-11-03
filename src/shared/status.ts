import type { SafeSwapStatus } from "@ammora-protocol/sdk";

export const describeSwapStatus = (status: SafeSwapStatus): string => {
  switch (status.type) {
    case "quote-refreshed": return "quote refreshed";
    case "approval-requested": return `approve ${status.amount} raw units of ${status.token}`;
    case "approval-submitted": return `approval submitted: ${status.hash}`;
    case "approval-confirmed": return `approval confirmed at block ${status.blockNumber}`;
    case "swap-requested": return "confirm swap";
    case "swap-submitted": return `swap submitted: ${status.hash}`;
    case "swap-confirmed": return `swap confirmed at block ${status.blockNumber}`;
    default: {
      const exhaustive: never = status;
      throw new Error(`Unknown swap status: ${String(exhaustive)}`);
    }
  }
};
