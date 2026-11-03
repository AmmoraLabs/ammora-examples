import { ContractFunctionRevertedError, ExecutionRevertedError } from "viem";

const causes = (error: unknown): unknown[] => {
  const found: unknown[] = [];
  let current = error;
  while (current && !found.includes(current)) {
    found.push(current);
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return found;
};

/** Transport failures must never be misreported as a burned NFT or a business revert. */
export const isContractRevert = (error: unknown): boolean => causes(error).some(
  (cause) => cause instanceof ContractFunctionRevertedError || cause instanceof ExecutionRevertedError,
);

export const isTransientReadError = (error: unknown): boolean => !isContractRevert(error) && causes(error).some((cause) => {
  if (!(cause instanceof Error)) return false;
  return /(?:429|502|503|504|ECONNRESET|ETIMEDOUT|fetch failed|timed out|too many requests)/i.test(cause.message);
});

/** One retry of an idempotent read; retain both failures and never repeat a revert. */
export const retryRead = async <T>(read: () => Promise<T>): Promise<T> => {
  try {
    return await read();
  } catch (first) {
    if (!isTransientReadError(first)) throw first;
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      return await read();
    } catch (second) {
      throw new AggregateError([first, second], "Read failed on its original attempt and one transient retry");
    }
  }
};
