import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sdk from '@ammora-protocol/sdk';
import * as fees from '../extensions/almm-unified/fee-claims-compat.js';
test('fee integration uses official SDK functions through a retained import path', () => {
  for (const name of ['almmFeeClaimRoutingAbi', 'getALMMFeeClaimReadiness', 'planSetALMMFeeClaimDelegate', 'planRevokeALMMFeeClaimDelegate', 'planClaimALMMPositionFeesTo'] as const) assert.equal(fees[name], sdk[name]);
});
test('fee adapter contains re-exports rather than a second fee implementation', () => {
  const code = readFileSync(new URL('../extensions/almm-unified/fee-claims-compat.ts', import.meta.url), 'utf8');
  assert.match(code, /from "@ammora-protocol\/sdk"/);
  assert.doesNotMatch(code, /async function|encodeFunctionData|readContract|privateKey/);
});
test('SDK 0.3.9 keeps fee-only routing separate from custody authority', () => {
  const names = new Set<string>(fees.almmFeeClaimRoutingAbi.map(x => 'name' in x ? x.name : ''));
  for (const name of ['setFeeClaimDelegate', 'setFeeClaimDelegateAnyRecipient', 'revokeFeeClaimDelegate', 'revokeAllFeeClaimDelegates', 'claimPositionFeeTo', 'claimPositionFeeToChunk']) assert(names.has(name));
  for (const name of ['transferFrom', 'safeTransferFrom', 'removeLiquidity', 'claimReward']) assert(!names.has(name));
});
