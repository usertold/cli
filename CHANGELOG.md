# Changelog

The complete pre-open-source 1.x package history is preserved in
[`docs/RELEASE_NOTES_1X.md`](docs/RELEASE_NOTES_1X.md).

## 3.0.0 — 2026-09-04

### Findings vocabulary

- Replaced the top-level `usertold work` command group with `usertold findings`; the new binary does not include a `work` alias.
- Renamed the Evidence list's entity filter from `--work` to `--finding` and updated Finding positional labels in machine-readable help.
- Renamed the CLI's explicit top-level JSON presentation keys from task terminology to Finding terminology while preserving nested API payloads, `/tasks/...` routes, and opaque `tsk_` references.
- Defined a Finding as an Evidence-backed synthesis that can be reviewed and sent to product triage; it is not automatically a task, solution, roadmap commitment, or delivery issue.

This is a major release because the command-group rename and JSON-key rename are intentionally breaking. Existing 2.x installations remain compatible with the retained server API.

## 2.0.0 — 2026-08-28

### A public, reviewable CLI

- Moved the `usertold` npm package into a dedicated public repository so its source, shipped files, build checks, and path to the npm registry can be inspected independently from the private UserTold service.
- Licensed the client under Apache-2.0 and added explicit trademark and third-party notices.
- Defined a continuously verified package boundary: only supported customer workflows, documentation, and license files ship. Private extraction, raw API, administration, forensics, forced termination, and operator repair commands stay out of the package.
- Added a reviewed release chain. Source, version, and workflow changes reach `main` only after human approval; merging a new version triggers the full package gate, direct npm publication with provenance, and creation of its GitHub tag and release. No human signing key or long-lived npm publishing token is required in CI.

### Complete customer workspace management

- Added complete customer workspace management for organizations, participants, invitations, documented Project settings, and GitHub/Linear delivery configuration.
- Added `auth browser-session` for short-lived Playwright, cookie, environment, or JWT browser credentials.
- Kept project configuration explicit: `settings` exposes only allowlisted product settings, and `knowledge` owns the typed knowledge HTTP action.

This is a major release because commands visible in the 1.x help surface were removed.
