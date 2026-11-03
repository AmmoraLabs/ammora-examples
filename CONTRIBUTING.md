# Contributing

Use Node 24 and the lockfile. Keep documentation and comments in English. Provide one focused example per operation and link related steps from a complete guide.

Run affected local tests, `npm run typecheck` and `npm run check:files`. For the opt-in extension, run `npm run unified:typecheck`. Do not publish packages or send transactions as part of installation or tests.

Keep secrets, local policies, signed transactions and wallet databases outside Git. Use exact approvals and explicit signer, claimant and payout addresses. Preserve submitted transaction identities and reconcile uncertain results instead of resending them.

Describe the changed behavior, validation performed and any deployment, authority or funding requirements in your pull request. Retain required license notices.
