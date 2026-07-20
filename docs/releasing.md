# Release and publishing checklist

This checklist covers a local VSIX, the Visual Studio Marketplace, and Open
VSX. Registry accounts, namespace ownership, access tokens, and signing
material stay outside this repository.

## Release identity

- Confirm the version in `package.json` and `CHANGELOG.md`.
- Confirm that `publisher` matches a publisher or namespace you control in both
  registries. Version 0.1.0 uses `ultra-fractal-tools` as the proposed value.
- Confirm the repository, homepage, issue tracker, license, icon, banner, and
  privacy links.
- Keep credentials out of source files, shell history, logs, VSIX files, and
  Git commits.

Changing `publisher` after publication creates a different extension identity.
Resolve publisher ownership before the first registry upload.

## Build and test

Use Node.js 20 or newer and a clean checkout:

```sh
npm ci
npm run verify
npm run corpus:verify
npm run benchmark:analyzer
npm run benchmark:grammar
npm run package:contents
npm run package:vsix
```

The corpus commands may print a skip on a clean checkout. Run them against the
local reference corpus before cutting a release when you have that corpus.

Review the `vsce ls --tree` output and the final VSIX archive. It must contain
the compiled runtime, grammar, language configuration, snippets, public docs,
and PNG artwork. It must exclude `uf-formulas/`, `uf6-manual.pdf`, TypeScript
sources, tests, source maps, credentials, and development dependencies.

## Clean-profile installation

Test the exact VSIX that you plan to publish:

1. Create a temporary VS Code profile or start VS Code with fresh
   `--user-data-dir` and `--extensions-dir` directories.
2. Install the VSIX through **Extensions: Install from VSIX...** or with
   `code --install-extension <file.vsix>`.
3. Open one original sample of each supported type: `.ufm`, `.ucl`, `.uxf`,
   and `.ulb`.
4. Confirm language selection, Dark+ and Light+ highlighting, folding,
   Outline symbols, snippets, diagnostics, and import navigation.
5. Set `ultraFractal.lint.enabled` to `false`. Confirm that highlighting,
   folding, Outline symbols, and snippets still work.
6. Re-enable linting and run **Ultra Fractal: Validate Current File**.
7. Close the profile and remove its temporary directories after the test.

Record the VS Code version, operating system, VSIX checksum, and result in the
release notes or release issue.

## Visual Studio Marketplace

1. Create or select the Visual Studio Marketplace publisher whose identifier
   matches `package.json`.
2. Follow Microsoft's current authentication guidance. Store the credential in
   a password manager or CI secret store.
3. Upload the tested VSIX through the publisher management page, or authenticate
   `vsce` and run `npx vsce publish --packagePath <file.vsix>`.
4. Check the listing, image rendering, links, version, and installation in a
   second clean profile.

Microsoft documents the current process in the
[VS Code publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

## Open VSX

1. Create an Eclipse account, link it to the GitHub account used for Open VSX,
   and accept the Open VSX Publisher Agreement.
2. Generate an Open VSX access token and keep it outside the repository.
3. Create or claim the namespace that matches `package.json`.
4. Upload the tested VSIX in the Open VSX web interface, or run
   `npx ovsx publish <file.vsix> -p <token>`.
5. Wait for registry scanning, then check the listing and install it in a clean
   VSCodium-compatible profile.

Open VSX maintains its current instructions in the
[Open VSX publishing guide](https://github.com/EclipseFdn/open-vsx.org/wiki/Publishing-Extensions).

## Publish the source release

- Commit the release changes and tag the commit as `v<version>`.
- Attach the tested VSIX and its SHA-256 checksum to the GitHub release.
- Copy the matching `CHANGELOG.md` section into the release notes.
- Verify that Git history and the VSIX contain no reference corpus, manual, or
  credential material.
- Keep the previous VSIX until users confirm that the registry release installs
  and activates.
