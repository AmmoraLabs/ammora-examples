/**
 * Open a position with the two sides funded in whatever ratio you pass.
 *
 *   npm run almm:create-position:imbalanced -- <pool> <baseAmount> <quoteAmount> [width]
 *
 * Same call as the balanced example, and the difference is only the amounts. Depositing away
 * from the pool's current ratio costs a composition fee on the active bin, which the quote
 * printed below already accounts for.
 */
import { createStrategyPosition } from "./shared.js";

createStrategyPosition({
  label: "imbalanced",
  strategy: 0,
  describe: "sides funded in the ratio given, which may cost a composition fee",
});
