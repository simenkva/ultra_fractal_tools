import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

interface LanguageContribution {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly configuration: string;
}

interface ExtensionManifest {
  readonly activationEvents: readonly string[];
  readonly contributes: {
    readonly languages: readonly LanguageContribution[];
  };
  readonly files: readonly string[];
}

interface CorpusSelection {
  readonly path: string;
  readonly kind: string;
}

interface CorpusManifest {
  readonly selections: readonly CorpusSelection[];
}

const projectRoot = path.resolve(__dirname, "../..");

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(path.join(projectRoot, relativePath), "utf8")) as T;

void test("extension manifest claims exactly the supported formula extensions", () => {
  const manifest = readJson<ExtensionManifest>("package.json");
  assert.equal(manifest.contributes.languages.length, 1);

  const language = manifest.contributes.languages[0];
  assert.ok(language);
  assert.equal(language.id, "ultra-fractal");
  assert.deepEqual(language.extensions, [".ufm", ".ucl", ".uxf", ".ulb"]);
  assert.equal(language.configuration, "./language-configuration.json");
  assert.deepEqual(manifest.activationEvents, ["onLanguage:ultra-fractal"]);
  assert.ok(!language.extensions.includes(".upr"));
  assert.ok(!language.extensions.includes(".txt"));
  assert.doesNotThrow(() =>
    readFileSync(path.join(projectRoot, language.configuration), "utf8"),
  );
});

void test("package allowlist excludes the corpus, manual, sources, and dependencies", () => {
  const manifest = readJson<ExtensionManifest>("package.json");
  const files = new Set(manifest.files);
  assert.ok(!files.has("uf-formulas"));
  assert.ok(!files.has("uf6-manual.pdf"));
  assert.ok(!files.has("src"));
  assert.ok(!files.has("node_modules"));
  assert.ok(files.has("out/extension.js"));
  assert.ok(files.has("out/editor/indentation.js"));
  assert.ok(files.has("out/editor/providers.js"));
  assert.ok(files.has("out/editor/structure.js"));
  for (const analyzerModule of [
    "out/analyzer/diagnostics.js",
    "out/analyzer/index.js",
    "out/analyzer/lexer.js",
    "out/analyzer/parser.js",
    "out/analyzer/source.js",
    "out/analyzer/types.js",
    "out/catalog/uf6.js",
  ]) {
    assert.ok(files.has(analyzerModule), `${analyzerModule} must be packaged`);
  }
  assert.ok(files.has("docs/diagnostics.md"));
});

void test("fixtures cover every supported kind and optional corpus paths are valid", () => {
  const manifest = readJson<CorpusManifest>("test/fixtures/corpus-manifest.json");
  const selectedKinds = new Set(manifest.selections.map(({ kind }) => kind));
  assert.deepEqual(selectedKinds, new Set(["ufm", "ucl", "uxf", "ulb"]));

  for (const selection of manifest.selections) {
    assert.match(selection.path, /^uf-formulas\/[A-Za-z0-9+_.-]+$/u);
    assert.equal(path.extname(selection.path), `.${selection.kind}`);
    if (existsSync(path.join(projectRoot, "uf-formulas"))) {
      assert.ok(
        existsSync(path.join(projectRoot, selection.path)),
        `missing optional local input ${selection.path}`,
      );
    }
  }

  for (const extension of ["ufm", "ucl", "uxf", "ulb"]) {
    assert.doesNotThrow(() =>
      readFileSync(path.join(projectRoot, `test/fixtures/minimal.${extension}`)),
    );
  }
});
