import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from "node:worker_threads";

import {
  analyze,
  DIAGNOSTIC_RULES,
  type DiagnosticRule,
  type DiagnosticSeverity,
  type FormulaFileType,
} from "../analyzer";
import { resolveImportPath } from "../editor/imports";

const projectRoot = path.resolve(__dirname, "../..");
const corpusDirectory = path.join(projectRoot, "uf-formulas");
const generatedReportPath = path.join(projectRoot, "out/corpus-analysis.json");
const baselinePath = path.join(
  projectRoot,
  "test/baselines/corpus-analysis.json",
);
const supportedFileTypes: readonly FormulaFileType[] = [
  "ufm",
  "ucl",
  "uxf",
  "ulb",
];
const supportedFileTypeSet = new Set<string>(supportedFileTypes);
const diagnosticRules = Object.values(DIAGNOSTIC_RULES);
const defaultTimeoutMilliseconds = 120_000;

export const compareCorpusPaths = (left: string, right: string): number =>
  left === right ? 0 : left < right ? -1 : 1;

export interface CorpusWorkerInput {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly fileType: FormulaFileType;
  readonly corpusRoot: string;
}

export interface CorpusFileResult {
  readonly path: string;
  readonly fileType: FormulaFileType;
  readonly bytes: number;
  readonly lines: number;
  readonly diagnostics: number;
  readonly errors: number;
  readonly warnings: number;
  readonly byRule: Readonly<Partial<Record<DiagnosticRule, number>>>;
  readonly milliseconds: number;
  readonly heapUsedBytes: number;
}

interface CorpusTotals {
  readonly files: number;
  readonly bytes: number;
  readonly lines: number;
  readonly diagnostics: number;
}

interface CorpusFileTypeSummary extends CorpusTotals {
  readonly errors: number;
  readonly warnings: number;
}

export interface CorpusAnalysisReport {
  readonly schemaVersion: 1;
  readonly status: "complete";
  readonly corpus: "uf-formulas";
  readonly totals: CorpusTotals;
  readonly bySeverity: Readonly<Record<DiagnosticSeverity, number>>;
  readonly byRule: Readonly<Record<DiagnosticRule, number>>;
  readonly byFileType: Readonly<
    Record<FormulaFileType, CorpusFileTypeSummary>
  >;
  readonly files: readonly Omit<
    CorpusFileResult,
    "milliseconds" | "heapUsedBytes"
  >[];
}

export const decodeCorpusSource = (buffer: Buffer): string =>
  buffer.toString("latin1");

const countLines = (source: string): number =>
  source.length === 0 ? 1 : source.split(/\r\n|\n|\r/u).length;

const emptyRuleCounts = (): Record<DiagnosticRule, number> =>
  Object.fromEntries(diagnosticRules.map((rule) => [rule, 0])) as Record<
    DiagnosticRule,
    number
  >;

const emptyFileTypeSummary = (): CorpusFileTypeSummary => ({
  files: 0,
  bytes: 0,
  lines: 0,
  diagnostics: 0,
  errors: 0,
  warnings: 0,
});

const analyzeCorpusFile = (input: CorpusWorkerInput): CorpusFileResult => {
  const buffer = readFileSync(input.absolutePath);
  const source = decodeCorpusSource(buffer);
  const started = performance.now();
  const diagnostics = analyze(source, {
    fileType: input.fileType,
    resolveImport: (importPath) => {
      const resolution = resolveImportPath(importPath, [
        path.dirname(input.absolutePath),
        input.corpusRoot,
      ]).status;
      return resolution === "missing" ? "unchecked" : resolution;
    },
  }).diagnostics;
  const byRule: Partial<Record<DiagnosticRule, number>> = {};
  let errors = 0;
  let warnings = 0;
  for (const diagnostic of diagnostics) {
    byRule[diagnostic.rule] = (byRule[diagnostic.rule] ?? 0) + 1;
    if (diagnostic.severity === "error") {
      errors += 1;
    } else {
      warnings += 1;
    }
  }
  const orderedByRule = Object.fromEntries(
    diagnosticRules
      .filter((rule) => byRule[rule] !== undefined)
      .map((rule) => [rule, byRule[rule]]),
  ) as Partial<Record<DiagnosticRule, number>>;
  return {
    path: input.relativePath,
    fileType: input.fileType,
    bytes: buffer.byteLength,
    lines: countLines(source),
    diagnostics: diagnostics.length,
    errors,
    warnings,
    byRule: orderedByRule,
    milliseconds: performance.now() - started,
    heapUsedBytes: process.memoryUsage().heapUsed,
  };
};

export const discoverCorpusInputs = (
  directory: string,
  root: string,
): readonly CorpusWorkerInput[] => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolutePath = path.join(entry.parentPath, entry.name);
      const extension = path.extname(entry.name).slice(1).toLowerCase();
      return { absolutePath, extension };
    })
    .filter(({ extension }) => supportedFileTypeSet.has(extension))
    .map(({ absolutePath, extension }) => ({
      absolutePath,
      relativePath: path
        .relative(root, absolutePath)
        .split(path.sep)
        .join("/"),
      fileType: extension as FormulaFileType,
      corpusRoot: directory,
    }))
    .sort((left, right) =>
      compareCorpusPaths(left.relativePath, right.relativePath),
    );
};

const corpusInputs = (): readonly CorpusWorkerInput[] =>
  discoverCorpusInputs(corpusDirectory, projectRoot);

const runWorker = (
  input: CorpusWorkerInput,
  timeoutMilliseconds = defaultTimeoutMilliseconds,
): Promise<CorpusFileResult> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: input,
      resourceLimits: {
        maxOldGenerationSizeMb: 768,
        maxYoungGenerationSizeMb: 64,
      },
    });
    let result: CorpusFileResult | undefined;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      void worker.terminate();
      reject(
        new Error(
          `${input.relativePath} exceeded ${String(timeoutMilliseconds)} ms`,
        ),
      );
    }, timeoutMilliseconds);
    worker.once("message", (message: CorpusFileResult) => {
      result = message;
    });
    worker.once("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
    worker.once("exit", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (code !== 0 || result === undefined) {
        reject(
          new Error(
            `${input.relativePath} analysis worker exited with ${String(code)}`,
          ),
        );
      } else {
        resolve(result);
      }
    });
  });

export const analyzeCorpusPath = (
  relativePath: string,
  timeoutMilliseconds = defaultTimeoutMilliseconds,
): Promise<CorpusFileResult> => {
  const extension = path.extname(relativePath).slice(1).toLowerCase();
  if (!supportedFileTypeSet.has(extension)) {
    return Promise.reject(
      new Error(`Unsupported corpus file type: ${relativePath}`),
    );
  }
  return runWorker(
    {
      absolutePath: path.join(projectRoot, relativePath),
      relativePath,
      fileType: extension as FormulaFileType,
      corpusRoot: corpusDirectory,
    },
    timeoutMilliseconds,
  );
};

const configuredConcurrency = (): number => {
  const parsed = Number.parseInt(process.env.UF_CORPUS_WORKERS ?? "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(4, parsed)) : 1;
};

const analyzeInputs = async (
  inputs: readonly CorpusWorkerInput[],
): Promise<readonly CorpusFileResult[]> => {
  const results: CorpusFileResult[] = [];
  let nextIndex = 0;
  const consume = async (): Promise<void> => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      const input = inputs[index];
      if (input !== undefined) {
        results.push(await runWorker(input));
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(configuredConcurrency(), inputs.length) },
      consume,
    ),
  );
  return results.sort((left, right) =>
    compareCorpusPaths(left.path, right.path),
  );
};

export function createCorpusReport(
  results: readonly CorpusFileResult[],
): CorpusAnalysisReport {
  const orderedResults = [...results].sort((left, right) =>
    compareCorpusPaths(left.path, right.path),
  );
  const byRule = emptyRuleCounts();
  const bySeverity: Record<DiagnosticSeverity, number> = {
    error: 0,
    warning: 0,
  };
  const byFileType: Record<FormulaFileType, CorpusFileTypeSummary> = {
    ufm: emptyFileTypeSummary(),
    ucl: emptyFileTypeSummary(),
    uxf: emptyFileTypeSummary(),
    ulb: emptyFileTypeSummary(),
  };
  const totals = {
    files: 0,
    bytes: 0,
    lines: 0,
    diagnostics: 0,
  };

  for (const result of orderedResults) {
    totals.files += 1;
    totals.bytes += result.bytes;
    totals.lines += result.lines;
    totals.diagnostics += result.diagnostics;
    bySeverity.error += result.errors;
    bySeverity.warning += result.warnings;
    const fileType = byFileType[result.fileType];
    byFileType[result.fileType] = {
      files: fileType.files + 1,
      bytes: fileType.bytes + result.bytes,
      lines: fileType.lines + result.lines,
      diagnostics: fileType.diagnostics + result.diagnostics,
      errors: fileType.errors + result.errors,
      warnings: fileType.warnings + result.warnings,
    };
    for (const rule of diagnosticRules) {
      byRule[rule] += result.byRule[rule] ?? 0;
    }
  }

  return {
    schemaVersion: 1,
    status: "complete",
    corpus: "uf-formulas",
    totals,
    bySeverity,
    byRule,
    byFileType,
    files: orderedResults.map(
      ({ path: filePath, fileType, bytes, lines, diagnostics, errors, warnings, byRule }) => ({
        path: filePath,
        fileType,
        bytes,
        lines,
        diagnostics,
        errors,
        warnings,
        byRule,
      }),
    ),
  };
}

const writeJson = (filePath: string, value: unknown): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const reportsMatch = (
  left: CorpusAnalysisReport,
  right: CorpusAnalysisReport,
): boolean => JSON.stringify(left) === JSON.stringify(right);

const main = async (): Promise<void> => {
  const inputs = corpusInputs();
  if (inputs.length === 0) {
    console.log(
      "SKIP: optional uf-formulas corpus is absent; no baseline was changed.",
    );
    return;
  }

  const started = performance.now();
  const results = await analyzeInputs(inputs);
  const report = createCorpusReport(results);
  writeJson(generatedReportPath, report);
  if (process.argv.includes("--write-baseline")) {
    writeJson(baselinePath, report);
  }
  if (process.argv.includes("--verify-baseline")) {
    if (!existsSync(baselinePath)) {
      throw new Error(
        "Corpus baseline is missing; run npm run corpus:baseline after review.",
      );
    }
    const baseline = JSON.parse(
      readFileSync(baselinePath, "utf8"),
    ) as CorpusAnalysisReport;
    if (!reportsMatch(report, baseline)) {
      throw new Error(
        "Corpus diagnostics differ from the reviewed baseline; inspect out/corpus-analysis.json.",
      );
    }
  }

  const slowest = [...results]
    .sort((left, right) => right.milliseconds - left.milliseconds)
    .slice(0, 5);
  console.log(
    `Analyzed ${String(report.totals.files)} files, ${report.totals.lines.toLocaleString("en-US")} lines, and ${report.totals.bytes.toLocaleString("en-US")} bytes in ${(performance.now() - started).toFixed(1)} ms.`,
  );
  console.log(
    `Diagnostics: ${String(report.bySeverity.error)} errors, ${String(report.bySeverity.warning)} warnings.`,
  );
  console.log(`Machine report: ${path.relative(projectRoot, generatedReportPath)}`);
  for (const result of slowest) {
    console.log(
      `Slow: ${result.path} ${result.milliseconds.toFixed(1)} ms (${result.lines.toLocaleString("en-US")} lines)`,
    );
  }
};

if (isMainThread) {
  if (require.main === module) {
    void main().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
} else {
  const result = analyzeCorpusFile(workerData as CorpusWorkerInput);
  parentPort?.postMessage(result);
}
