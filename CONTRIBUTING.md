# Contributing

Thanks for improving the UserTold CLI.

## Scope

This repository accepts changes to the public API client, command help, documentation, packaging, and tests. The hosted service, research engine, model prompts, database, administrative controls, and operator repair tools are maintained privately and are out of scope here.

If a proposal requires a new service capability, open a focused issue describing the user outcome and public API contract before implementing a command.

## Development

1. Use Node.js 20 or newer.
2. Run `npm install`.
3. Make a focused change with tests and help updates.
4. Run `npm run check`.
5. Open a pull request explaining the public user outcome and verification.

Do not add commands that accept arbitrary API paths, setting keys, database queries, model prompts, or privileged operator actions. The boundary check is intentionally a release gate, not the only review of that policy.

By contributing, you agree that your contribution is licensed under Apache-2.0.
