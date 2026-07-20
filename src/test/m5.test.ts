import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { analyze, DIAGNOSTIC_RULES } from "../analyzer";
import {
  AnalysisCancelledError,
  runAnalysisInWorker,
  type CancellationLike,
} from "../editor/analysis-service";
import {
  createCorpusReport,
  compareCorpusPaths,
  decodeCorpusSource,
  discoverCorpusInputs,
  type CorpusFileResult,
} from "./corpus-scan";

const projectRoot = path.resolve(__dirname, "../..");

class TestCancellation implements CancellationLike {
  private readonly listeners = new Set<() => void>();
  public isCancellationRequested = false;

  public onCancellationRequested(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  public cancel(): void {
    this.isCancellationRequested = true;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const corpusResult = (
  overrides: Partial<CorpusFileResult>,
): CorpusFileResult => ({
  path: "uf-formulas/example.ufm",
  fileType: "ufm",
  bytes: 100,
  lines: 10,
  diagnostics: 0,
  errors: 0,
  warnings: 0,
  byRule: {},
  milliseconds: 12.5,
  heapUsedBytes: 1_024,
  ...overrides,
});

void test("M5 corpus reports are deterministic and omit timing and source text", () => {
  const report = createCorpusReport([
    corpusResult({
      path: "uf-formulas/library.ulb",
      fileType: "ulb",
      bytes: 50,
      lines: 5,
      errors: 1,
      diagnostics: 1,
      byRule: { UF1002: 1 },
      milliseconds: 99,
    }),
    corpusResult({
      warnings: 1,
      diagnostics: 1,
      byRule: { UF2004: 1 },
    }),
  ]);
  assert.deepEqual(report.totals, {
    files: 2,
    bytes: 150,
    lines: 15,
    diagnostics: 2,
  });
  assert.deepEqual(report.bySeverity, { error: 1, warning: 1 });
  assert.equal(report.byRule.UF1002, 1);
  assert.equal(report.byRule.UF2004, 1);
  assert.equal(report.byRule.UF1004, 0);
  assert.deepEqual(
    report.files.map(({ path: filePath }) => filePath),
    ["uf-formulas/example.ufm", "uf-formulas/library.ulb"],
  );
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes("milliseconds"));
  assert.ok(!serialized.includes("heapUsedBytes"));
  assert.ok(!serialized.includes("source"));
  assert.ok(!serialized.includes("message"));
});

void test("the reviewed corpus baseline is complete, sorted, and source-free", () => {
  const baseline = JSON.parse(
    readFileSync(
      path.join(projectRoot, "test/baselines/corpus-analysis.json"),
      "utf8",
    ),
  ) as ReturnType<typeof createCorpusReport>;
  assert.equal(baseline.schemaVersion, 1);
  assert.equal(baseline.status, "complete");
  assert.equal(baseline.totals.files, 403);
  assert.equal(
    baseline.totals.diagnostics,
    baseline.bySeverity.error + baseline.bySeverity.warning,
  );
  assert.deepEqual(
    baseline.files.map(({ path: filePath }) => filePath),
    baseline.files
      .map(({ path: filePath }) => filePath)
      .sort(compareCorpusPaths),
  );
  const serialized = JSON.stringify(baseline);
  for (const excluded of [
    "source",
    "message",
    "range",
    "milliseconds",
    "heapUsedBytes",
  ]) {
    assert.ok(!serialized.includes(`"${excluded}"`));
  }
  assert.deepEqual(
    discoverCorpusInputs(path.join(projectRoot, "absent-corpus"), projectRoot),
    [],
  );
});

void test("latin-1 bytes and mixed corpus line endings analyze safely", () => {
  const source = decodeCorpusSource(
    Buffer.concat([
      Buffer.from("comment {\rCopyright ", "ascii"),
      Buffer.from([0xe9]),
      Buffer.from("\r\r\n}\rEncoding-Test {\r\ninit:\r  z = #pixel\r\n}\r", "ascii"),
    ]),
  );
  assert.ok(source.includes("é"));
  assert.deepEqual(analyze(source, { fileType: "ufm" }).diagnostics, []);
});

void test("corpus-derived preamble and entry-name regressions stay fixed", () => {
  const source = readFileSync(
    path.join(projectRoot, "test/analyzer/corpus-regressions.ufm"),
    "utf8",
  );
  assert.deepEqual(analyze(source, { fileType: "ufm" }).diagnostics, []);
});

void test("analysis workers complete normally and can be terminated promptly", async () => {
  const completeCancellation = new TestCancellation();
  assert.deepEqual(
    await runAnalysisInWorker(
      {
        source: "Worker-Test {\ninit:\n  z = #pixel\n}\n",
        fileType: "ufm",
        roots: [],
      },
      completeCancellation,
    ),
    [],
  );

  const cancellation = new TestCancellation();
  const largeSource = `Large-Worker-Test {\ninit:\n${"  z = z + #pixel\n".repeat(200_000)}}\n`;
  const started = performance.now();
  const pending = runAnalysisInWorker(
    { source: largeSource, fileType: "ufm", roots: [] },
    cancellation,
  );
  setTimeout(() => cancellation.cancel(), 10);
  await assert.rejects(pending, AnalysisCancelledError);
  assert.ok(
    performance.now() - started < 5_000,
    "terminating an obsolete worker took too long",
  );
});

void test("M5 manifest exposes corpus and performance commands and workers", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  ) as {
    readonly files: readonly string[];
    readonly scripts: Readonly<Record<string, string>>;
  };
  for (const script of [
    "corpus:scan",
    "corpus:baseline",
    "corpus:verify",
    "benchmark:analyzer",
    "benchmark:grammar",
  ]) {
    assert.ok(manifest.scripts[script], `${script} must be available`);
  }
  for (const runtimeModule of [
    "out/editor/analysis-service.js",
    "out/editor/analysis-worker.js",
    "docs/corpus-validation.md",
    "docs/performance.md",
  ]) {
    assert.ok(manifest.files.includes(runtimeModule));
  }
  assert.equal(DIAGNOSTIC_RULES.missingImport, "UF2003");
});
