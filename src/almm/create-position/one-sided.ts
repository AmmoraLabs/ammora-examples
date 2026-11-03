/**
 * Open a position funded from one side only.
 *
 *   npm run almm:create-position:one-sided -- <pool> <baseAmount> <quoteAmount> [width]
 *
 * Pass 0 for the side you are not funding. A one-sided position sits entirely above or
 * below the active bin and fills as price moves into it, the same shape a resting order
 * takes.
 */
import { createStrategyPosition } from "./shared.js";

createStrategyPosition({
  label: "one-sided",
  strategy: 0,
  describe: "funded from a single side, filling as price moves into the range",
  requireOneSided: true,
});
