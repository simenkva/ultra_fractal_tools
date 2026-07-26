# Related-File Bundles

## Treat a bundle as a project, not a new UF6 language unit

A bundle can contain a fractal formula, one or more coloring algorithms,
transformations, and supporting libraries. Ultra Fractal still compiles and
selects entries according to its own file and import rules. Bundle checks in
this skill add deterministic project-level observations; they do not replace
UF6 compilation or create new language requirements.

Run the structural analyzer on all affected files in one invocation. Preserve
the analyzer's `UF` diagnostics exactly.

Use `scripts/check_bundle.py` when the task also needs related-file
conventions:

```sh
python3 scripts/check_bundle.py formula.ufm coloring.ucl
python3 scripts/check_bundle.py --manifest bundle.json --format json
```

The helper reports project advisories with stable `UFB` identifiers:

- `UFB1001`: a manifest role does not match the file extension;
- `UFB1002`: an expected definition is absent;
- `UFB1003`: an expected definition has a different entry/class kind;
- `UFB2001`: a case-insensitive definition identifier occurs in more than one
  file.

`UFB2001` is informational by default because separate UF files may legally
reuse an identifier. Set `uniqueDefinitionIdentifiers` in a manifest when the
project intentionally requires uniqueness; the helper then promotes the
advisory to a warning. None of these identifiers are UF6 compiler messages.

## Use an optional manifest

Keep the manifest small and original:

```json
{
  "schemaVersion": 1,
  "target": "UF6",
  "files": [
    {
      "path": "family.ufm",
      "role": "fractal",
      "expectedDefinitions": [
        { "name": "MyFamily", "kind": "entry" }
      ]
    },
    {
      "path": "bands.ucl",
      "role": "coloring",
      "expectedDefinitions": [
        { "name": "MyBands", "kind": "entry" }
      ]
    }
  ],
  "conventions": {
    "uniqueDefinitionIdentifiers": false
  }
}
```

Manifest paths are relative to the manifest directory. Valid roles are
`fractal`, `coloring`, `transformation`, and `library`, corresponding to
`.ufm`, `.ucl`, `.uxf`, and `.ulb`. Expected definition kinds are `entry` and
`class`.

Pass additional files on the command line when they belong to the current
change but are not yet in the manifest. The helper must not copy source into
its report.

## Review bundle conventions with judgment

After deterministic checks:

1. Identify the intended role of every file and entry.
2. Confirm companion files use coherent titles, terminology, defaults, units,
   and parameter group ordering where the project intends them to match.
3. Verify imports only with exhaustive search paths.
4. Check that saved-parameter-set or documentation references will retain
   stable entry identifiers.
5. Compile each affected entry in UF6.
6. Render a fixed baseline using the complete formula, coloring,
   transformation, location, iteration, and precision configuration.

Do not promote naming, caption, or parameter conventions into UF language
rules. Report them as review findings without `UF` identifiers.

## Protect bundle privacy

Prefer `--path-mode basename` when reports may be shared. Keep manifests,
formula contents, compiler logs, screenshots, and absolute installation paths
local unless the user explicitly authorizes sharing.
