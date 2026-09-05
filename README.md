# UserTold CLI

The open-source command-line client for [UserTold.ai](https://usertold.ai).

UserTold runs consented in-product interviews and keeps participant voice, transcript, and page context connected to the same research record, together with screen capture when a participant approves it on a supported desktop browser. This CLI lets you and your coding agent review source-linked Evidence, synthesize it into Findings, and send reviewed Findings to product triage.

## Install

```bash
npm install --global usertold
usertold auth login
```

Node.js 20 or newer is required.

## Research-to-triage workflow

The service captures and processes Interviews, extracts source-linked Evidence,
and may suggest draft Findings. The CLI is the review and delivery surface; it
does not perform local extraction or silently decide that a Finding is ready.

```bash
# Find and select the Project used by later commands
usertold organization list
usertold project list
usertold project use acme/checkout

# Create a draft Study, review its proposed script, then save it
usertold study create --title "Checkout usability" --handle checkout-usability --visibility @visibility.json
usertold study validate-script checkout-usability --script @study-script.json
usertold study update checkout-usability --script @study-script.json

# Install the Project widget once and verify the target page
usertold project snippet
usertold project verify-widget-installation --url https://example.com/checkout

# Activation begins matching eligible participants; then verify the winner
usertold study update checkout-usability --status active
usertold study resolve --path /checkout

# Follow one Interview through processing
usertold interview list --study checkout-usability
usertold interview watch int_123 --evidence

# Inspect the participant record and extracted Evidence
usertold interview transcript int_123
usertold interview enriched-timeline int_123
usertold evidence list --interview int_123

# Review suggested Findings and their supporting Evidence
usertold findings list --interview int_123
usertold findings get fnd_123

# After review, mark the Finding ready and send it
usertold findings update fnd_123 --status ready --priority 80 --effort m
usertold findings push fnd_123
usertold findings push-status fnd_123
```

Use `findings create-from-evidence` only when selected Evidence is genuinely
unlinked or needs deliberate regrouping. Review the underlying Interview and
Evidence before moving a Finding to `ready`. `findings push` uses the delivery
provider configured in the dashboard; `--provider github` or `--provider linear`
is an explicit override.

`usertold init` is the fast bootstrap path. When it creates a Study, it also
creates its Intake, enables all-page Visibility, and activates both resources.
Use the explicit commands above when you want to inspect placement and scripts
before collection begins.

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
| `init` | Bootstrap a Project and optionally create and activate an all-pages Study with its Intake |
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
