# CLI Release Notes

Archived 1.x semver history for the published `usertold` CLI package. Starting
with 2.0.0, the public client, changelog, version, and npm publication workflow
live in [usertold/cli](https://github.com/usertold/cli). This file is retained
as historical context and no longer tracks this private application's version.

The date-led public development journal lives in `PUBLIC_CHANGELOG.md`.

## 1.25.1 — Discoverable MCP identity (2026-08-28)

- MCP catalogues and clients receive the same concise capability description,
  product homepage, and icon from the public server identity.

## 1.25.0 — Recruitment links and concise Invitations (2026-08-12)

- Study Invitations now offer one concise launcher and optional panel editor with exact duration, reward, and terms copy plus faithful responsive previews.
- Direct-link Invitations return an opaque, revocable customer-page recruitment URL that selects only its exact active Study and never carries participant identity or falls back to another Study.
- Web, REST, CLI, OpenAPI, and public guidance now use the same strict Invitation contract and project-only embed.

## 1.24.2 — Safe CLI change previews (2026-08-09)

- `--dry-run` now previews every mutating CLI command without changing remote resources, credentials, configuration, or local files.

## 1.24.1 — Clearer interview capture and MCP connection (2026-08-06)

- Public and CLI package descriptions now explain that UserTold captures in-product interviews and returns source-linked evidence.
- MCP OAuth discovery now identifies the exact remote transport URL expected by Claude Code, Codex, and other path-aware clients.

## 1.24.0 — Responsive Study widget appearance (2026-08-01)

- Study widget appearance now configures the launcher label, accessible light and dark brand colors, and separate desktop/mobile corners once for every installation.
- The CLI and MCP Study commands can read, update, and reset the same saved widget appearance while keeping the installation snippet minimal.

## 1.23.1 — Safer CLI identity checks (2026-08-01)

- `usertold auth whoami --json` now reports identity and session metadata without exposing the active bearer token.

## 1.23.0 — Readable widget setup (2026-07-29)

- CLI setup and widget snippets now use readable Project and Study references instead of opaque storage IDs.
- The CLI release now verifies the built npm artifact uses the current widget contract before publication.

## 1.22.0 — Recoverable project cleanup (2026-06-08)

- Deleted projects, studies, interviews, evidence, and work now use recoverable soft deletion consistently.
- The CLI no longer offers a bulk evidence-delete command that could bypass that recovery model.
- Related list, lookup, and processing paths ignore deleted records without losing their audit history.

## 1.21.0 — A clearer path from setup to evidence (2026-06-04)

- The dashboard and study editor now guide builders from project setup through the first interview and first evidence.
- Interview lists, evidence, and work support larger projects with pagination and more consistent navigation.
- Builders can import custom audio or video interviews through the CLI and MCP surfaces for standard transcription and evidence processing.
- The interview widget is available in English, German, Spanish, French, Japanese, Russian, and Simplified Chinese.

## 1.20.0 — Evidence-first research workflows (2026-05-22)

- Evidence review and work tracking now keep source context attached from interview playback through Linear handoff.
- Completed Linear work resolves linked evidence while future interviews can surface possible recurrence.
- Project navigation and overview pages focus on the actions that need a builder's attention.
- Public guides, API documentation, and agent-facing setup flows now describe the shipped evidence-first workflow.

## 1.19.0 — Faster interview review (2026-03-28)

- The interview review workspace puts recording playback, transcript context, and extracted evidence into a simpler review flow.
- Landing and documentation updates make the path from in-product interviews to evidence-backed work easier to understand.
