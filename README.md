# UserTold CLI

The open-source command-line client for [UserTold.ai](https://usertold.ai).

UserTold runs a voice interview when a real user gets stuck, in the same session, so the quote, screen, and page path stay together. This CLI lets you and your coding agent review that source-linked evidence before it becomes prioritized work or a GitHub or Linear issue.

## Install

```bash
npm install --global usertold
usertold auth login
```

Node.js 20 or newer is required.

## Start

```bash
# See the projects available to you
usertold project list

# Select a default project for later commands
usertold project use acme/checkout

# Review interviews and source-linked evidence
usertold interview list
usertold evidence list

# Inspect prioritized work before delivery
usertold work list
```

Every command supports human-readable help. Agents and scripts can inspect the same command model as JSON:

```bash
usertold --help
usertold evidence --help
usertold evidence list --help --json
```

Use `--json` for machine-readable command output and `--dry-run` to inspect supported mutations before sending them.

## Public command surface

| Group | Purpose |
| --- | --- |
| `auth` | Sign in, sign out, and inspect the active identity |
| `project` | Create, select, inspect, and install a Project |
| `study` | Create and manage interview Studies and their scripts |
| `intake` | Configure participant qualification and review responses |
| `interview` | Import, inspect, download, and safely reprocess Interviews |
| `evidence` | Review and curate source-linked Evidence |
| `work` | Prioritize Evidence-backed Work and push reviewed work to delivery |
| `knowledge` | Configure and test the typed project knowledge HTTP action |
| `billing` | Read usage and billing status |
| `export` | Request and download your account data export |
| `init` | Bootstrap a Project and Study |
| `completions` | Generate shell completions |

The installed version's `usertold --help` is authoritative.

## Deliberate boundary

This repository is a public API client, not the UserTold application or research engine. It does not contain local evidence extraction, model prompts, database access, raw API passthrough, administrative controls, interview forensics, forced interview termination, bulk Study repair, or media-pipeline repair commands. Those capabilities are private operator tooling and are not shipped to npm.

The UserTold service, dashboard, interview runtime, evidence extraction, prioritization engine, and operational tooling remain closed source. See [TRADEMARKS.md](TRADEMARKS.md) for the distinction between the Apache-licensed code and the UserTold name.

## Environments and configuration

Production is the default. `--env stage` and `--env local` are intended for UserTold development and explicitly configured environments. Credentials and the selected Project are stored per environment in the user's configuration directory; the CLI never writes them into a repository.

For product secrets, the public CLI exposes only supported typed workflows such as `knowledge apply`. Arbitrary settings mutation is intentionally absent.

## Development

```bash
npm install
npm run check
node dist/usertold.js --help
```

`npm run check` type-checks and tests the client, builds the distributable executable, verifies the public/private boundary, and inspects the npm tarball.

Contributions are welcome for the public client. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening a pull request or reporting a vulnerability.

## License

Apache License 2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
