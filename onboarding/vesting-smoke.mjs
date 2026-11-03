// Public npm only. Read/unsigned demo: no wallet, key, approval or transaction sender.
import { randomBytes } from 'node:crypto';
import { createPublicClient, custom, defineChain, erc20Abi, toHex } from 'viem';
import {
  AmmoraTokenLockClient, giwaSepoliaTokenLockDeployment,
  giwaSepoliaAutoRoute, giwaSepoliaAutoRouteDeployment,
  planAmmoraLaunchVesting, resolveAmmoraFinalizedHead,
  parseAmmoraTokenLockClaimReceipt,
} from '@ammora-protocol/sdk';

if (process.env.AMMORA_SEND === '1') throw new Error('This demo never sends transactions');
const catalog = giwaSepoliaAutoRouteDeployment.chain;
const rpcUrl = process.env.AMMORA_RPC_URL || catalog.rpcUrls[0];
if (!rpcUrl) throw new Error('RPC URL is required');
const chain = defineChain({ id: catalog.id, name: catalog.name,
  nativeCurrency: catalog.nativeCurrency, rpcUrls: { default: { http: [rpcUrl] } } });
// GIWA's public endpoint counts individual methods. Serialize calls; do not retry writes.
let queue = Promise.resolve();
let id = 0;
const transport = custom({ request: (args) => {
  const result = queue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, 600));
    const response = await fetch(rpcUrl, { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, ...args }) });
    if (!response.ok) throw new Error('RPC HTTP status ' + response.status);
    const body = await response.json();
    if (body.error) throw new Error('RPC error: ' + body.error.message);
    return body.result;
  });
  queue = result.then(() => undefined, () => undefined);
  return result;
} }, { retryCount: 0 });
const client = createPublicClient({ chain, transport });
if (await client.getChainId() !== 91342) throw new Error('GIWA Sepolia 91342 required');
const locks = new AmmoraTokenLockClient(client, giwaSepoliaTokenLockDeployment);
const head = await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality);
const block = await client.getBlock({ blockNumber: head });

// Public fixtures are for observation only. They do not belong to the reader.
const actor = '0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637';
const token = '0x036b035533B42D6f6459C04E2D902A452250f2c7';
const lock = '0x852Dc7B07361C9bab17024f20F25804502728f07';
const claimHash = '0x424cc845d895f050bc8a261120c88501f8a398915cb73711a52718549490d16d';
const state = await locks.readAtBlock(lock, head);
const allocation = planAmmoraLaunchVesting({ totalAmountRaw: 8n,
  cliffUnlockAmountRaw: 2n, numberOfPeriods: 3, frequencySeconds: 20n,
  cliffDurationSeconds: 10n });
const start = block.timestamp + 3600n;
const creation = await locks.planCreateAtBlock({ token, recipient: actor, caller: actor,
  userSalt: toHex(randomBytes(32)), blockNumber: head,
  parameters: { vestingStartTime: start, cliffTime: start + allocation.config.cliffDuration,
    frequency: allocation.config.frequency, cliffUnlockAmount: allocation.config.cliffUnlockAmount,
    amountPerPeriod: allocation.config.amountPerPeriod, numberOfPeriods: allocation.config.numberOfPeriods,
    cancelMode: 0, updateRecipientMode: 0, metadataHash: '0x0000000000000000000000000000000000000000000000000000000000000000' } });

// This lock is already completed. Demonstrate a claim plan at its pre-claim block,
// then reconcile the existing confirmed receipt. NEVER send this historical plan.
const receipt = await client.getTransactionReceipt({ hash: claimHash });
if (receipt.status !== 'success' || receipt.blockNumber > head) throw new Error('Unconfirmed receipt');
const receiptBlock = await client.getBlock({ blockNumber: receipt.blockNumber });
if (receiptBlock.hash !== receipt.blockHash) throw new Error('Noncanonical receipt');
const historicalPlan = await locks.planClaimAtBlock({ lock, caller: actor,
  maximumAmount: 8n, blockNumber: receipt.blockNumber - 1n });
const claimed = parseAmmoraTokenLockClaimReceipt(receipt, historicalPlan);
const balance = async (blockNumber = receipt.blockNumber) => client.readContract({ address: token, abi: erc20Abi,
  functionName: 'balanceOf', args: [actor], blockNumber });
const before = await balance(receipt.blockNumber - 1n);
const after = await balance(receipt.blockNumber);
if (after - before !== claimed.amount || claimed.amount !== 8n) throw new Error('Payout mismatch');
if ((await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('Receipt reorg');
console.log(JSON.stringify({ mode: 'READ_ONLY_AND_UNSIGNED', chainId: 91342,
  allocationRaw: allocation.totalAmountRaw, currentLock: { address: lock,
    completed: state.completed, claimable: state.claimable, custody: state.tokenBalance },
  createPreview: { status: creation.status, totalAmount: creation.totalAmount,
    recipient: creation.recipient, unsignedTransaction: creation.transaction },
  historicalClaim: { transactionHash: claimHash, amount: claimed.amount,
    recipientBalanceIncrease: after - before, replayAllowed: false }, newTransactions: 0,
}, (_, value) => typeof value === 'bigint' ? String(value) : value, 2));
