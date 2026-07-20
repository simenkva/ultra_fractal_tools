import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { listFiles, PackageManager } from "@vscode/vsce";

interface ReleaseManifest {
  readonly name: string;
  readonly displayName: string;
  readonly version: string;
  readonly publisher: string;
  readonly license: string;
  readonly preview: boolean;
  readonly icon: string;
  readonly repository: { readonly url: string };
  readonly homepage: string;
  readonly bugs: { readonly url: string };
  readonly files: readonly string[];
  readonly scripts: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly contributes: {
    readonly configuration: {
      readonly properties: Readonly<Record<string, unknown>>;
    };
  };
}

const projectRoot = path.resolve(__dirname, "../..");

const readProjectFile = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readProjectFile(relativePath)) as T;

const readPngSize = (
  relativePath: string,
): { readonly width: number; readonly height: number } => {
  const content = readFileSync(path.join(projectRoot, relativePath));
  assert.deepEqual(
    content.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    `${relativePath} must be a PNG`,
  );
  assert.equal(content.subarray(12, 16).toString("ascii"), "IHDR");
  return {
    width: content.readUInt32BE(16),
    height: content.readUInt32BE(20),
  };
};

void test("M6 release metadata identifies a versioned public extension", () => {
  const manifest = readJson<ReleaseManifest>("package.json");
  assert.equal(manifest.name, "ultra-fractal-language");
  assert.equal(manifest.displayName, "Ultra Fractal Language Support");
  assert.equal(manifest.version, "0.1.0");
  assert.match(manifest.publisher, /^[a-z0-9][a-z0-9-]*$/u);
  assert.equal(manifest.preview, true);
  assert.equal(manifest.icon, "images/icon.png");
  assert.equal(
    manifest.repository.url,
    "https://github.com/simenkva/ultra_fractal_tools.git",
  );
  assert.equal(
    manifest.homepage,
    "https://github.com/simenkva/ultra_fractal_tools#readme",
  );
  assert.equal(
    manifest.bugs.url,
    "https://github.com/simenkva/ultra_fractal_tools/issues",
  );
  assert.notEqual(manifest.license, "UNLICENSED");
  assert.ok(existsSync(path.join(projectRoot, "LICENSE")));
});

void test("M6 package manifest includes release assets and reproducible commands", () => {
  const manifest = readJson<ReleaseManifest>("package.json");
  const packagedFiles = new Set(manifest.files);
  for (const required of [
    "CHANGELOG.md",
    "LICENSE",
    "PRIVACY.md",
    "SUPPORT.md",
    "docs/releasing.md",
    "images/icon.png",
    "images/highlighting.png",
    "images/diagnostics.png",
  ]) {
    assert.ok(packagedFiles.has(required), `${required} must be packaged`);
    assert.ok(existsSync(path.join(projectRoot, required)), `${required} is missing`);
  }
  assert.equal(manifest.devDependencies["@vscode/vsce"], "3.9.2");
  assert.equal(manifest.scripts["vscode:prepublish"], "npm run compile");
  assert.ok(manifest.scripts["package:contents"]?.includes("vsce ls"));
  assert.ok(manifest.scripts["package:vsix"]?.includes("vsce package"));
});

void test("vsce resolves a source-free package with no reference inputs", async () => {
  const packagedFiles = (
    await listFiles({
      cwd: projectRoot,
      packageManager: PackageManager.None,
    })
  ).sort();
  for (const required of [
    "CHANGELOG.md",
    "LICENSE",
    "PRIVACY.md",
    "README.md",
    "SUPPORT.md",
    "images/icon.png",
    "language-configuration.json",
    "out/extension.js",
    "package.json",
    "snippets/ultra-fractal.code-snippets",
    "syntaxes/ultra-fractal.tmLanguage.json",
  ]) {
    assert.ok(packagedFiles.includes(required), `${required} must be in the VSIX`);
  }
  for (const file of packagedFiles) {
    assert.ok(!file.startsWith("assets/"), `${file} is an artwork source`);
    assert.ok(!file.startsWith("src/"), `${file} is a TypeScript source`);
    assert.ok(!file.startsWith("test/"), `${file} is a test input`);
    assert.ok(!file.startsWith("node_modules/"), `${file} is a dependency`);
    assert.ok(!file.startsWith("uf-formulas/"), `${file} is corpus material`);
    assert.notEqual(file, "uf6-manual.pdf");
    assert.ok(!file.endsWith(".map"), `${file} is a source map`);
  }
  assert.ok(packagedFiles.length < 50, "the VSIX file set grew unexpectedly");
});

void test("release artwork has Marketplace-safe PNG dimensions", () => {
  assert.deepEqual(readPngSize("images/icon.png"), {
    width: 256,
    height: 256,
  });
  for (const screenshot of [
    "images/highlighting.png",
    "images/diagnostics.png",
  ]) {
    const dimensions = readPngSize(screenshot);
    assert.ok(dimensions.width >= 1_000);
    assert.ok(dimensions.height >= 500);
  }
});

void test("public documentation covers installation, limits, privacy, and support", () => {
  const readme = readProjectFile("README.md");
  for (const requiredText of [
    ".ufm",
    ".ucl",
    ".uxf",
    ".ulb",
    "Install from VSIX",
    "ultraFractal.lint.enabled",
    "Validation limits",
    "does not compile or run formulas",
    "Reporting problems",
    "PRIVACY.md",
  ]) {
    assert.ok(readme.includes(requiredText), `README must cover ${requiredText}`);
  }
  assert.ok(readme.includes("images/highlighting.png"));
  assert.ok(readme.includes("images/diagnostics.png"));
  assert.ok(!/\]\([^)]*\.svg(?:[?#)]|$)/iu.test(readme));

  const changelog = readProjectFile("CHANGELOG.md");
  assert.ok(changelog.includes("## 0.1.0 - 2026-07-20"));
  assert.ok(changelog.includes("do not replace the Ultra Fractal compiler"));

  const privacy = readProjectFile("PRIVACY.md");
  assert.ok(privacy.includes("does not collect telemetry"));
  assert.ok(privacy.includes("does not") && privacy.includes("network"));

  const support = readProjectFile("SUPPORT.md");
  assert.ok(support.includes("GitHub issue tracker"));
  assert.ok(support.includes("third-party formula code"));
});

void test("publishing checklist keeps credentials external and covers both registries", () => {
  const guide = readProjectFile("docs/releasing.md");
  for (const requiredText of [
    "Clean-profile installation",
    "Visual Studio Marketplace",
    "Open VSX",
    "outside this repository",
    "uf-formulas/",
    "uf6-manual.pdf",
    "lint.enabled",
    "SHA-256",
  ]) {
    assert.ok(guide.includes(requiredText), `release guide must cover ${requiredText}`);
  }

  const manifest = readJson<ReleaseManifest>("package.json");
  assert.equal(
    existsSync(path.join(projectRoot, ".vscodeignore")),
    false,
    "vsce rejects a files allowlist combined with .vscodeignore",
  );
  const packagedFiles = new Set(manifest.files);
  for (const excluded of [
    "uf-formulas",
    "uf6-manual.pdf",
    "src",
    "test",
    "out/test",
    "node_modules",
  ]) {
    assert.ok(!packagedFiles.has(excluded), `${excluded} must be excluded`);
  }
});

void test("the release manifest exposes every documented setting", () => {
  const manifest = readJson<ReleaseManifest>("package.json");
  assert.deepEqual(
    Object.keys(manifest.contributes.configuration.properties).sort(),
    [
      "ultraFractal.formulaSearchPaths",
      "ultraFractal.lint.debounceMilliseconds",
      "ultraFractal.lint.enabled",
      "ultraFractal.lint.maxDiagnostics",
      "ultraFractal.lint.severityOverrides",
    ],
  );
});
