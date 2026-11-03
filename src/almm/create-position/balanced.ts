/**
 * Open a bin-pool position with both sides funded evenly across a range.
 *
 *   npm run almm:create-position:balanced -- <pool> <baseAmount> <quoteAmount> [width]
 *
 * `width` is how many bins either side of the active one to cover; it defaults to 2.
 */
import { createStrategyPosition } from "./shared.js";

createStrategyPosition({
  label: "balanced",
  // Spot spreads the deposit evenly, so both sides are put to work at once.
  strategy: 0,
  describe: "both sides funded, spread evenly across the range",
});
