# Changelog

The complete pre-open-source 1.x package history is preserved in
[`docs/RELEASE_NOTES_1X.md`](docs/RELEASE_NOTES_1X.md).

## 2.0.0 — Unreleased

- Moved the public `usertold` npm package to its own open-source repository.
- Licensed the client under Apache-2.0 and added explicit trademark and third-party notices.
- Reduced the package to supported customer workflows; private extraction, raw API, admin, forensic, forced-termination, and operator repair commands are no longer shipped.
- Added complete customer workspace management for organizations, participants, invitations, documented Project settings, and GitHub/Linear delivery configuration.
- Added `auth browser-session` for short-lived Playwright, cookie, environment, or JWT browser credentials.
- Kept project configuration explicit: `settings` exposes only allowlisted product settings, and `knowledge` owns the typed knowledge HTTP action.
- Added public-boundary and npm-tarball verification gates plus npm trusted-publishing workflow preparation.

This is a major release because commands visible in the 1.x help surface were removed.
