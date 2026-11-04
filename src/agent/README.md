# Agent contract examples

See [partner permissions and review boundaries](../../PERMISSIONS.md). Wallet signatures, token approvals and local request review are your own authorization; asset policies, actual fee rights and administrator actions retain their contract checks.

Start with [the agent launchpad guide](../../AGENT-LAUNCHPAD.md). Import
[index.ts](index.ts) into trusted application code and register only
`agentTools(agent)` with the model. The same handlers work with local tools,
function calling or a partner-owned authenticated transport. Contract calls use
the configured chain RPC.

Run `node scripts/package-agent.mjs /absolute/path/to/new-agent-project` from
the repository root to export this directory and exactly its local TypeScript
dependencies into a new project with pinned public npm dependencies. The exporter
refuses an existing destination and includes no key, environment or journal files.
Alternatively, use the complete repository. The agent
entry point never imports the environment signer helper. The full repository
is the simplest reproducible starting point.

- [examples/connect.ts](examples/connect.ts): connect a public policy, shared RPC and optional injected signer.
- [examples/actions.ts](examples/actions.ts): token creation, atomic first buy, buy/sell, final fill, migration and claims.
- [examples/host.ts](examples/host.ts): exact-plan owner approval, outside the model tool registry.
- [cli.ts](cli.ts): JSON Lines read/plan/reconcile adapter; no signer is constructed.
- [policy.example.json](policy.example.json): public policy template; replace placeholders, expiry and economic limits.

Use Node 24.18.0 for the `node:sqlite` journal. The journal directory must be
private (0700), its database private (0600), and shared by all local processes
using the same signing wallet. Multiple hosts need a separately reviewed shared
transactional store and nonce coordinator. Do not place journal files in Git;
pending signed bytes are confidential and are never returned by tools.

The upstream 35-case offline suite is recorded as reused evidence in the
[public validation summary](https://docs.ammora.org/guides/agent-validation).
Repository-only tests are excluded from this download. Use the
[public quickstart](https://docs.ammora.org/guides/agent-quickstart) for installation,
typecheck, tool schemas and live read-only validation without an invitation.
