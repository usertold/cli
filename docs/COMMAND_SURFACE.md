# MCP and CLI command coverage

UserTold uses one product vocabulary across the dashboard, MCP server, and CLI:
**Organization**, **Project**, **Study**, **Interview**, **Evidence**, and **Finding**.
Canonical Findings responses use that vocabulary directly. Older internal nouns
remain only in API families that have not yet moved to canonical DTOs, where the
CLI remaps deliberate top-level output keys.

## Research-to-triage workflow

The customer workflow crosses six deliberate phases:

1. Create or select a Project, install its widget once, and verify the intended page.
2. Create a draft Study, review its script and placement, then explicitly activate it.
3. Follow completed Interviews through processing and inspect transcript, timeline, and capture limitations.
4. Review extracted Evidence, including counter-evidence and coverage gaps.
5. Review server-suggested draft Findings or deliberately create one from selected unlinked Evidence.
6. Mark a verified Finding `ready`, then explicitly send it to the configured product-triage provider.

The service owns Interview processing, Evidence extraction, and draft Finding
suggestions. The CLI transports and presents those records; it does not embed the
private extraction or prioritization engine.

Finding lifecycle values accepted by `findings list --status` and
`findings update --status` are `backlog`, `ready`, `in_progress`, `done`, and
`wont_fix`. `ready` means reviewed and not yet sent. The canonical API represents
these as separate research and delivery states, but the CLI retains this compact
public lifecycle for 3.0.0.

`findings push` omits provider selection by default so the service can use the
Project's dashboard configuration. `--provider auto` is equivalent; `github` and
`linear` explicitly override the configured selection.

## MCP is the focused agent loop

The public MCP server deliberately exposes the smallest complete
research-to-triage loop. The closest CLI paths are:

| MCP tool | CLI counterpart |
| --- | --- |
| `projects.create` | `project create` |
| `projects.get_widget_setup` | `project snippet` |
| `projects.verify_widget_installation` | `project verify-widget-installation` |
| `studies.validate_script` | `study validate-script` for an existing Study; MCP also validates standalone drafts |
| `studies.list` | `study list` |
| `studies.get` | `study get` |
| `studies.create` | `study create` |
| `studies.update` | `study update` |
| `studies.get_results` | `interview list`, `evidence list`, and `findings list` |
| `interviews.list` | `interview list` |
| `interviews.get_context` | `interview get`, `interview transcript`, `interview timeline` |
| `interviews.get_artifacts` | `interview transcript`, `interview media`, `interview audio`, `interview screen` |
| `interviews.processing_status` | `interview status` |
| `interviews.retry_processing` | `interview reprocess` |
| `evidence.list` | `evidence list` |
| `evidence.get` | `evidence get` |
| `evidence.update` | `evidence annotate`, `evidence dismiss`, `evidence undismiss` |
| `findings.list` | `findings list` |
| `findings.get_evidence` | `findings get` (includes linked Evidence) |
| `findings.create_from_evidence` | `findings create-from-evidence` |
| `findings.update` | `findings update` |
| `findings.send` | `findings push` |

## CLI is the complete customer workspace client

The CLI includes the MCP loop and the broader operations needed to manage a
customer workspace without relying on an undocumented endpoint:

- authentication, identity, Terms acceptance, and short-lived browser sessions;
- organization creation, participant roles, Project access, and invitations;
- complete Project, Study, Intake, Interview, Evidence, and Finding lifecycle commands;
- documented Project settings and the typed knowledge action;
- GitHub App installation selection, repository selection, health, diagnostics,
  and disconnect; Linear connection status, team selection, and disconnect;
- billing inspection, account export, bootstrapping, and shell completions.

GitHub and Linear authorization must pass through the provider's browser consent
screen. The CLI prints the correct connection URL and can mint a short-lived
Playwright storage-state file with `auth browser-session`; all configuration and
verification after provider consent remains available from the CLI.

## Private operator boundary

The npm package does not contain service-wide administration, arbitrary HTTP
passthrough, local evidence extraction or model prompts, interview forensics,
forced interview termination, raw event inspection, bulk Study repair, or media
pipeline repair. Those commands can affect infrastructure or bypass normal
customer workflows and remain in UserTold's private operator repository.

The executable's `usertold --help --json` output is the machine-readable source
of truth for the installed version.
