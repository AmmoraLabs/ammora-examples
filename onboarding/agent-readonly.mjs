/** Keyless GIWA smoke: public Config reads through the real agent adapter. */
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAddress, isAddress } from 'viem';
import { getAmmoraV4ConfigAtBlock, resolveAmmoraFinalizedHead, giwaSepoliaAutoRoute } from '@ammora-protocol/sdk';
import { AgentRuntime, agentTools, core, createAgentRpc, toolDefinitions } from '../src/agent/index.ts';

// Optional public address for reads only. This default is not a signing wallet.
const address = process.argv[2] ?? '0x000000000000000000000000000000000000dEaD';
if (process.argv.length > 3 || !isAddress(address)) throw new Error('usage: agent-readonly.mjs [PUBLIC_ADDRESS]');
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Use Node 24.18.0 or later in the Node 24 line');
const rpc = createAgentRpc();
const directory = await mkdtemp(join(tmpdir(), 'ammora-agent-readonly-'));
await chmod(directory, 0o700);
let agent;
try {
  const template = await rpc.bounded(async () => {
    const block = await resolveAmmoraFinalizedHead([rpc.client], giwaSepoliaAutoRoute.finality);
    return getAmmoraV4ConfigAtBlock(rpc.client, core.configRegistry, 6n, block);
  });
  const account = getAddress(address);
  const policy = {
    sessionId: 'readonly-' + Date.now(), account, expiresAt: Math.floor(Date.now() / 1000) + 600,
    actions: ['config', 'launch', 'trade', 'migrate', 'claim-launch', 'claim-lp', 'approval'],
    configs: [{ id: '6', hash: template.configHash }], payouts: [account],
    assets: [{ token: template.config.quoteToken, maxInputRaw: '1', maxSessionInputRaw: '1' }],
    launchTokenLimit: { maxInputRaw: '1', maxSessionInputRaw: '1' },
    maxNativePerTransactionWei: '100000000000000', maxNativeSessionWei: '100000000000000',
    maxFeePerGasWei: '100000000', maxTransactions: 1, maxSlippageBps: 50,
    maxPlanAgeSeconds: 180, maxPlanAgeBlocks: 180,
  };
  agent = new AgentRuntime({ policy, client: rpc.client, journalDirectory: directory });
  const tools = agentTools(agent);
  const context = await rpc.bounded(() => tools.agent_get_context({}));
  const config = await rpc.bounded(() => tools.agent_get_config({ configId: '6' }));
  if (context.chainId !== 91342 || context.sdkVersion !== '0.3.9' || config.configHash !== template.configHash || !config.enabled) throw new Error('GIWA agent read mismatch');
  console.log(JSON.stringify({ sdk: context.sdkVersion, chainId: context.chainId, configId: '6', configHash: config.configHash,
    quoteToken: config.config.quoteToken, snapshot: context.snapshot, toolDefinitions: toolDefinitions.length,
    signerConnected: false, transactionsSubmitted: 0, rpc: rpc.stats() }, null, 2));
} finally {
  agent?.close();
  await rm(directory, { recursive: true, force: true });
}
