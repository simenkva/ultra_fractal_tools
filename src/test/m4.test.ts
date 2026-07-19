import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DIAGNOSTIC_RULES,
  type Diagnostic,
  type DiagnosticRule,
} from "../analyzer";
import { importSearchRoots, resolveImportPath } from "../editor/imports";
import {
  disabledDiagnosticRules,
  normalizeValidationSettings,
  selectDisplayDiagnostics,
} from "../editor/validation";

interface ConfigurationProperty {
  readonly type: string;
  readonly default: unknown;
  readonly minimum?: number;
  readonly maximum?: number;
}

interface ExtensionManifest {
  readonly activationEvents: readonly string[];
  readonly files: readonly string[];
  readonly contributes: {
    readonly commands: readonly {
      readonly command: string;
      readonly title: string;
      readonly category: string;
    }[];
    readonly configuration: {
      readonly properties: Readonly<Record<string, ConfigurationProperty>>;
    };
  };
}

const projectRoot = path.resolve(__dirname, "../..");

const sourceRange = (offset: number) => ({
  start: { offset, line: 0, character: offset },
  end: { offset: offset + 1, line: 0, character: offset + 1 },
});

const analyzerDiagnostic = (
  rule: DiagnosticRule,
  severity: Diagnostic["severity"],
  offset: number,
): Diagnostic => ({
  rule,
  severity,
  message: rule,
  range: sourceRange(offset),
});

void test("M4 settings normalize bounds, paths, and stable severity overrides", () => {
  const defaults = normalizeValidationSettings({});
  assert.equal(defaults.enabled, true);
  assert.equal(defaults.debounceMilliseconds, 300);
  assert.equal(defaults.maxDiagnostics, 100);
  assert.deepEqual(defaults.formulaSearchPaths, []);
  assert.equal(defaults.severityOverrides.size, 0);

  const configured = normalizeValidationSettings({
    enabled: false,
    debounceMilliseconds: 9_999,
    maxDiagnostics: 2.9,
    severityOverrides: {
      UF1001: "hint",
      UF2004: "off",
      UF9999: "error",
      UF1002: "invalid",
    },
    formulaSearchPaths: [" formulas ", "formulas", "", 42],
  });
  assert.equal(configured.enabled, false);
  assert.equal(configured.debounceMilliseconds, 5_000);
  assert.equal(configured.maxDiagnostics, 2);
  assert.deepEqual(configured.formulaSearchPaths, ["formulas"]);
  assert.deepEqual(
    [...configured.severityOverrides.entries()],
    [
      [DIAGNOSTIC_RULES.unterminatedString, "hint"],
      [DIAGNOSTIC_RULES.legacySyntax, "off"],
    ],
  );
  assert.deepEqual(disabledDiagnosticRules(configured), [
    DIAGNOSTIC_RULES.legacySyntax,
  ]);
});

void test("severity overrides, disabled rules, and diagnostic limits compose", () => {
  const diagnostics = [
    analyzerDiagnostic(DIAGNOSTIC_RULES.unterminatedString, "error", 0),
    analyzerDiagnostic(DIAGNOSTIC_RULES.legacySyntax, "warning", 1),
    analyzerDiagnostic(DIAGNOSTIC_RULES.sectionOrder, "warning", 2),
    analyzerDiagnostic(DIAGNOSTIC_RULES.duplicateParameter, "warning", 3),
  ];
  const settings = normalizeValidationSettings({
    maxDiagnostics: 2,
    severityOverrides: {
      UF1001: "information",
      UF2004: "off",
    },
  });
  assert.deepEqual(
    selectDisplayDiagnostics(diagnostics, settings).map(
      ({ rule, displaySeverity }) => ({ rule, displaySeverity }),
    ),
    [
      {
        rule: DIAGNOSTIC_RULES.unterminatedString,
        displaySeverity: "information",
      },
      {
        rule: DIAGNOSTIC_RULES.sectionOrder,
        displaySeverity: "warning",
      },
    ],
  );
});

void test("import resolution checks document, workspace, and configured roots", () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "uf-imports-"));
  try {
    const documentDirectory = path.join(temporaryRoot, "document");
    const workspaceRoot = path.join(temporaryRoot, "workspace");
    const configuredAbsolute = path.join(temporaryRoot, "shared");
    mkdirSync(documentDirectory);
    mkdirSync(path.join(workspaceRoot, "formulas"), { recursive: true });
    mkdirSync(configuredAbsolute);
    writeFileSync(path.join(documentDirectory, "nearby.ulb"), "class Nearby {}\n");
    writeFileSync(
      path.join(workspaceRoot, "formulas", "CaseSensitive.ULB"),
      "class Shared {}\n",
    );
    writeFileSync(path.join(configuredAbsolute, "absolute.ufm"), "Entry {}\n");

    const roots = importSearchRoots({
      documentPath: path.join(documentDirectory, "current.ufm"),
      workspaceRoots: [workspaceRoot],
      configuredPaths: ["formulas", configuredAbsolute, "formulas"],
    });
    assert.deepEqual(roots, [
      documentDirectory,
      workspaceRoot,
      path.join(workspaceRoot, "formulas"),
      configuredAbsolute,
    ]);
    assert.equal(resolveImportPath("nearby.ulb", roots).status, "found");
    assert.equal(resolveImportPath("casesensitive.ulb", roots).status, "found");
    assert.equal(resolveImportPath("absolute.ufm", roots).status, "found");
    assert.equal(resolveImportPath("missing.ulb", roots).status, "missing");
    assert.deepEqual(resolveImportPath("missing.ulb", []), {
      status: "unchecked",
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

void test("manifest contributes the M4 command, settings, and runtime modules", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  ) as ExtensionManifest;
  assert.ok(
    manifest.activationEvents.includes(
      "onCommand:ultraFractal.validateCurrentFile",
    ),
  );
  assert.deepEqual(manifest.contributes.commands, [
    {
      command: "ultraFractal.validateCurrentFile",
      title: "Validate Current File",
      category: "Ultra Fractal",
    },
  ]);

  const properties = manifest.contributes.configuration.properties;
  assert.equal(properties["ultraFractal.lint.enabled"]?.default, true);
  assert.equal(
    properties["ultraFractal.lint.debounceMilliseconds"]?.default,
    300,
  );
  assert.equal(properties["ultraFractal.lint.maxDiagnostics"]?.default, 100);
  assert.equal(
    properties["ultraFractal.lint.severityOverrides"]?.type,
    "object",
  );
  assert.equal(properties["ultraFractal.formulaSearchPaths"]?.type, "array");

  for (const runtimeModule of [
    "out/editor/diagnostics.js",
    "out/editor/imports.js",
    "out/editor/navigation.js",
    "out/editor/validation.js",
  ]) {
    assert.ok(manifest.files.includes(runtimeModule));
  }
});
