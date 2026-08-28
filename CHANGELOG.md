# Changelog

## 2.0.0 — Unreleased

- Moved the public `usertold` npm package to its own open-source repository.
- Licensed the client under Apache-2.0 and added explicit trademark and third-party notices.
- Reduced the package to supported customer workflows; private extraction, raw API, admin, forensic, forced-termination, and operator repair commands are no longer shipped.
- Replaced arbitrary project setting mutation with the typed `knowledge` command group.
- Added public-boundary and npm-tarball verification gates plus npm trusted-publishing workflow preparation.

This is a major release because commands visible in the 1.x help surface were removed.
