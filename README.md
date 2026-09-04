# UserTold CLI

The open-source command-line client for [UserTold.ai](https://usertold.ai).

UserTold runs a voice interview when a real user gets stuck, in the same session, so the quote, screen, and page path stay together. This CLI lets you and your coding agent review source-linked Evidence, synthesize it into Findings, and send reviewed Findings to product triage.

## Install

```bash
npm install --global usertold
usertold auth login
```

Node.js 20 or newer is required.

## Start

```bash
# See and manage the workspaces available to you
usertold organization list
usertold project list

# Select a default project for later commands
usertold project use acme/checkout

# Review interviews and source-linked evidence
usertold interview list
usertold evidence list

# Inspect Evidence-backed Findings before product triage
usertold findings list
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
| `auth` | Sign in, inspect identity, and mint short-lived browser credentials |
| `organization` | Create workspaces and manage participants, roles, access, and invitations |
| `project` | Create, select, inspect, and install a Project |
| `study` | Create and manage interview Studies and their scripts |
| `intake` | Configure participant qualification and review responses |
| `interview` | Import, inspect, download, and safely reprocess Interviews |
| `evidence` | Review and curate source-linked Evidence |
| `findings` | Review Evidence-backed Findings and send reviewed Findings to product triage |
| `settings` | Read, validate, set, and remove documented Project settings |
| `knowledge` | Configure and test the typed project knowledge HTTP action |
| `integration` | Install, inspect, configure, verify, and disconnect GitHub or Linear delivery |
| `billing` | Read usage and billing status |
| `export` | Request and download your account data export |
| `init` | Bootstrap a Project and Study |
| `completions` | Generate shell completions |

The installed version's `usertold --help` is authoritative. See
[MCP and CLI command coverage](docs/COMMAND_SURFACE.md) for the exact vocabulary mapping and customer/operator boundary.

## Deliberate boundary

This repository is a public API client, not the UserTold application or research engine. It does not contain local evidence extraction, model prompts, database access, raw API passthrough, administrative controls, interview forensics, forced interview termination, bulk Study repair, or media-pipeline repair commands. Those capabilities are private operator tooling and are not shipped to npm.

The UserTold service, dashboard, interview runtime, evidence extraction, prioritization engine, and operational tooling remain closed source. See [TRADEMARKS.md](TRADEMARKS.md) for the distinction between the Apache-licensed code and the UserTold name.

## Environments and configuration

Production is the default. `--env stage` and `--env local` are intended for UserTold development and explicitly configured environments. Credentials and the selected Project are stored per environment in the user's configuration directory; the CLI never writes them into a repository.

Project configuration is typed and allowlisted: `settings` currently manages only `openai_api_key` and `retention_days`, while `knowledge` owns the Project knowledge action. Arbitrary configuration mutation is intentionally absent.

`usertold auth browser-session` exchanges a durable CLI OAuth login for short-lived browser credentials. Its default output is a Playwright `storageState` document; `--format env`, `cookie`, and `jwt` support other automation clients. Use `--output` to write credentials with mode `0600`.

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
