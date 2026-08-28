# Publishing

Releases are built by GitHub Actions and staged through npm trusted publishing with provenance. A package becomes public only after a human package owner inspects and approves the staged artifact with npm 2FA. No long-lived npm token belongs in this repository.

## One-time npm configuration

Before the first 2.x release, a package owner must replace the existing trusted publisher for `usertold` with:

- Organization or user: `usertold`
- Repository: `cli`
- Workflow: `publish.yml`
- Environment: `npm`
- Allowed action: `npm stage publish` only

Then configure the protected GitHub environment named `npm` to allow only tags matching `v*`. The workflow runs from a release tag, not from the `main` branch ref.

Set npm publishing access to **Require two-factor authentication and disallow bypass 2FA tokens**, then revoke obsolete automation/write tokens. Trusted OIDC publishing continues to work without those tokens.

This account-level npm change is intentionally not automated by repository code.

## Release

1. Have the Coding GitHub App open a pull request updating `package.json` and `CHANGELOG.md`.
2. Obtain approval from the human code owner after CI passes.
3. Merge the exact reviewed head to `main`.
4. From a trusted human environment, create an annotated, signed `v<package version>` tag on the current `main` head and push it without force.
5. Create a non-prerelease GitHub release for that existing tag.
6. Wait for `Publish npm package` to build, verify, and stage the exact tarball.
7. Inspect the pending stage with `npm stage view <stage-id>` and, when needed, `npm stage download <stage-id>`.
8. Approve it with `npm stage approve <stage-id>` and complete npm 2FA.
9. Verify `npm view usertold version dist-tags repository dist.integrity --json` and install the exact version in a clean temporary directory.

The release workflow refuses:

- prereleases;
- a lightweight or unverified tag;
- a tag that does not point to the current `main` head;
- a tag that does not match `package.json`;
- a version that already exists on npm.

The build job has no OIDC permission. Only the final environment-scoped stage job can request an npm OIDC credential, and that job consumes the already-built tarball without checking out or executing repository code.
