# Changelog

The complete pre-open-source 1.x package history is preserved in
[`docs/RELEASE_NOTES_1X.md`](docs/RELEASE_NOTES_1X.md).

## 3.0.0 — 2026-09-05

### A simpler model from research to product decisions

UserTold now presents one consistent mental model across the CLI and the service:

- **Interviews** are the source record of what a participant said and did.
- **Evidence** is the source-linked analysis extracted from those Interviews and kept reviewable against the original record.
- **Findings** synthesize related Evidence into a problem worth evaluating. A Finding can be reviewed and prioritized without implying that a solution has been chosen or delivery has been committed.

This separation also makes the lifecycle clearer. Research review establishes
whether a Finding is supported and ready for product consideration; delivery
tracks what happens only after it is intentionally sent to GitHub or Linear.
Research maturity and product execution are related, but they are not the same
state.

To make that model real rather than a vocabulary layer, 3.0.0 aligns the public
interface with the canonical internal implementation. `usertold findings` now
uses the canonical Finding API and DTOs directly, help follows the complete
Study → Interview → Evidence → Finding journey, and tracker selection defaults
to the Project configuration in the dashboard while allowing an explicit
provider override.

### Migration from 2.x

- `usertold work` is now `usertold findings`; there is no `work` alias.
- The Evidence list filter `--work` is now `--finding`.
- Finding JSON uses the canonical Finding response model rather than task-shaped presentation keys.
- Opaque references remain pass-through values, and existing 2.x installations continue to work through the service's retained compatibility API.

The packaged JSON help, shell-facing command metadata, documentation, and HTTP
User-Agent now describe and report this same 3.0.0 interface consistently.

This is a major release because the command-group, filter, and JSON model changes
are intentionally breaking for scripts written against 2.x.

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
