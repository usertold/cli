# Publishing

Releases are published from GitHub Actions with npm trusted publishing and provenance. No long-lived npm token belongs in this repository.

## One-time npm configuration

Before the first 2.x release, a package owner must replace the existing trusted publisher for `usertold` with:

- Organization or user: `usertold`
- Repository: `cli`
- Workflow: `publish.yml`
- Environment: `npm`

Then create a protected GitHub environment named `npm` and restrict deployment to the `main` branch.

This account-level npm change is intentionally not automated by repository code.

## Release

1. Update `package.json` and `CHANGELOG.md` in a reviewed pull request.
2. Run `npm run check` from a clean checkout.
3. Merge to `main`.
4. Create a GitHub release tagged `v<package version>` from that commit.
5. Wait for `Publish npm package` to succeed.
6. Verify `npm view usertold version dist-tags --json` and install the exact version in a clean temporary directory.

The release workflow refuses a tag that does not match `package.json` or a version that already exists on npm.
