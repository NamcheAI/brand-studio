# Releasing the packages

The public packages are:

- `@namche/metaball` — core geometry, next release `2.0.0`;
- `@namche/metaball-react` — React/Three.js viewer, next release `0.2.0`.

The renderer depends on the core package, so core is always published first.

Both packages use npm trusted publishing through
`.github/workflows/release-packages.yml`. The repository does not keep an npm
publish token; GitHub Actions obtains short-lived credentials through OIDC.

## One-time npm setup

Both package names were unclaimed on npm when this workflow was added. npm can
only configure a trusted publisher after a package exists, so each name needs
one bootstrap publish by a NAMCHE npm owner:

1. Add a short-lived granular token as the repository secret
   `NPM_BOOTSTRAP_TOKEN`.
2. On the release branch, temporarily add
   `NODE_AUTH_TOKEN: ${{ secrets.NPM_BOOTSTRAP_TOKEN }}` to the publish step's
   environment and dispatch `.github/workflows/release-packages.yml` for that
   branch once.
3. Configure that exact workflow as trusted publisher for the new package on
   npm.
4. Delete `NPM_BOOTSTRAP_TOKEN` and remove the temporary environment entry;
   all later publishes use GitHub OIDC.

The repository was renamed from `NamcheAI/metaball` to `NamcheAI/brand-studio`
on 2026-09-28. npm binds a trusted publisher to the repository name, so each
package's trusted publisher on npmjs.com (package → Settings → Trusted
publishing) must name `NamcheAI/brand-studio` and
`.github/workflows/release-packages.yml` before the next release; provenance
also requires the packages' `repository.url` to match, which it now does.

This bootstrap was completed on 2026-08-19. Do not recreate the secret during
normal releases. Repeat these steps only when introducing a new npm package
name that cannot yet be assigned a trusted publisher.

The workflow uses Node 24 and the latest npm CLI because npm trusted publishing
requires Node 22.14+ and npm 11.5.1+. Do not keep a long-lived publish token.

Both public packages are licensed under MIT. The editor application is not part
of that grant. The Namche name and logos remain trademarks, and the package
license does not grant trademark rights or permission to imply endorsement.
The SIL Open Font License used by the Namche Shadow project applies to fonts
only.

## Release flow

1. Update package versions and [`CHANGELOG.md`](../CHANGELOG.md) in a pull
   request.
2. Run `npm run release:dry-run` and inspect both file manifests.
3. Merge only after normal CI and review pass.
4. In GitHub Actions, run **Release packages** and choose the npm dist-tag.
5. The workflow builds/tests everything and publishes only package versions
   that do not already exist. It publishes core before renderer.
6. Verify with `npm view @namche/metaball version` and
   `npm view @namche/metaball-react version`, then install in a clean example.

Do not run `npm publish` from a developer laptop unless recovering from a
documented trusted-publishing outage.
