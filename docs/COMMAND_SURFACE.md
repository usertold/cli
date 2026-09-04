# MCP and CLI command coverage

UserTold uses one product vocabulary across the dashboard, MCP server, and CLI:
**Organization**, **Project**, **Study**, **Interview**, **Evidence**, and **Finding**.
Canonical Findings responses use that vocabulary directly. Older internal nouns
remain only in API families that have not yet moved to canonical DTOs, where the
CLI remaps deliberate top-level output keys.

## MCP is the focused agent loop

The public MCP server deliberately exposes the smallest complete
research-to-triage loop. Each MCP tool has a direct CLI counterpart:

| MCP tool | CLI counterpart |
| --- | --- |
| `projects.create` | `project create` |
| `projects.get_widget_setup` | `project snippet` |
| `projects.verify_widget_installation` | `project verify-widget-installation` |
| `studies.validate_script` | `study validate-script` |
| `studies.list` | `study list` |
| `studies.get` | `study get` |
| `studies.create` | `study create` |
| `studies.update` | `study update` |
| `interviews.list` | `interview list` |
| `interviews.get_context` | `interview get`, `interview transcript`, `interview timeline` |
| `interviews.processing_status` | `interview status` |
| `interviews.retry_processing` | `interview reprocess` |
| `evidence.list` | `evidence list` |
| `evidence.get` | `evidence get` |
| `findings.list` | `findings list` |
| `findings.get_evidence` | `findings get` (includes linked Evidence) |
| `findings.create_from_evidence` | `findings create-from-evidence` |
| `findings.update` | `findings update` |
| `findings.push` | `findings push` |

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
