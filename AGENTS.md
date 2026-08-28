# AGENTS.md

This repository contains only the public UserTold CLI.

- Keep the command registry, human help, JSON help, completions, README, and tests in sync.
- Treat `src/cli/commands/command-registry.ts` as the public command contract.
- Do not add raw API passthrough, arbitrary settings mutation, database access, local evidence extraction, model prompts, admin controls, forensic commands, forced interview termination, or operator repair commands.
- Keep the hosted service and private monorepo out of this repository, including their git history.
- Run `npm run check` before opening a pull request.
- Use Apache-2.0-compatible dependencies and update `THIRD_PARTY_NOTICES.md` when a bundled dependency changes.
