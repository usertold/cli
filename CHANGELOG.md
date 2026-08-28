# Changelog

The complete pre-open-source 1.x package history is preserved in
[`docs/RELEASE_NOTES_1X.md`](docs/RELEASE_NOTES_1X.md).

## 2.0.0 — 2026-08-28

### A public, reviewable CLI

- Moved the `usertold` npm package into a dedicated public repository so its source, shipped files, build checks, and path to the npm registry can be inspected independently from the private UserTold service.
- Licensed the client under Apache-2.0 and added explicit trademark and third-party notices.
- Defined a continuously verified package boundary: only supported customer workflows, documentation, and license files ship. Private extraction, raw API, administration, forensics, forced termination, and operator repair commands stay out of the package.
- Added a reviewed release chain. Source and workflow changes reach `main` only after human approval; a human-signed release tag triggers the full package gate and direct npm publication with provenance through a short-lived trusted-publishing credential. No long-lived npm publishing token is required.

### Complete customer workspace management

- Added complete customer workspace management for organizations, participants, invitations, documented Project settings, and GitHub/Linear delivery configuration.
- Added `auth browser-session` for short-lived Playwright, cookie, environment, or JWT browser credentials.
- Kept project configuration explicit: `settings` exposes only allowlisted product settings, and `knowledge` owns the typed knowledge HTTP action.

This is a major release because commands visible in the 1.x help surface were removed.
