# Publishing

Releases publish from GitHub Actions with npm trusted publishing and provenance. No long-lived npm token belongs in this repository.

## One-time npm configuration

Configure the `usertold` package trusted publisher with:

- Provider: GitHub Actions
- Organization or user: `usertold`
- Repository: `cli`
- Workflow: `publish.yml`
- Environment: `npm`
- Allowed action: `npm publish` only

Set npm Publishing access to **Require two-factor authentication and disallow bypass 2FA tokens**. Trusted publishing uses a short-lived OIDC credential rather than an npm token.

## Release

1. Have the Coding GitHub App open a pull request updating `package.json` and `CHANGELOG.md`.
2. Obtain approval from the human code owner after CI passes.
3. Merge the reviewed change to `main`.
4. From a trusted human environment, create and push an annotated, signed `v<package version>` tag on the reviewed commit.
5. Create a non-prerelease GitHub release for that existing tag.
6. The release workflow checks the tag against `package.json`, runs the full package gate, and publishes with npm provenance.
7. Verify `npm view usertold version dist-tags repository dist.integrity --json` and install the exact version in a clean temporary directory.

If a release run fails before publication, fix the workflow through the normal reviewed pull-request process, then rerun the existing signed tag without moving it:

```sh
gh workflow run publish.yml --repo usertold/cli -f tag=v2.0.0
```

The workflow accepts only stable `v<major>.<minor>.<patch>` tags whose version matches `package.json`, and refuses a version that already exists on npm.
