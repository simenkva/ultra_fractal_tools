import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";

import {
  DIAGNOSTIC_RULES,
  type Diagnostic,
  type DiagnosticRule,
  type FormulaFileType,
} from "../analyzer";
import {
  AnalysisCancelledError,
  runAnalysisDetailsInWorker,
  type AnalysisDefinitionSummary,
  type CancellationLike,
} from "../editor/analysis-service";

const supportedFileTypes = new Set<FormulaFileType>([
  "ufm",
  "ucl",
  "uxf",
  "ulb",
]);
const diagnosticRules = new Set<string>(Object.values(DIAGNOSTIC_RULES));

type OutputFormat = "text" | "json";
type SourceEncoding = "utf8" | "latin1";
type ImportMode = "unchecked" | "exhaustive";
type PathMode = "relative" | "basename";

export interface CliOptions {
  readonly files: readonly string[];
  readonly stdin: boolean;
  readonly fileType?: FormulaFileType;
  readonly format: OutputFormat;
  readonly encoding: SourceEncoding;
  readonly importMode: ImportMode;
  readonly searchPaths: readonly string[];
  readonly disabledRules: readonly DiagnosticRule[];
  readonly failOnWarnings: boolean;
  readonly timeoutMilliseconds: number;
  readonly pathMode: PathMode;
}

interface FileReport {
  readonly path: string;
  readonly fileType: FormulaFileType;
  readonly encoding: SourceEncoding;
  readonly definitions: readonly AnalysisDefinitionSummary[];
  readonly diagnostics: readonly Diagnostic[];
}

interface CliReport {
  readonly schemaVersion: 1;
  readonly target: "UF6";
  readonly validationLevel: "structural";
  readonly compiled: false;
  readonly rendered: false;
  readonly files: readonly FileReport[];
  readonly summary: {
    readonly files: number;
    readonly errors: number;
    readonly warnings: number;
  };
}

const usage = `Usage:
  npm run analyze:formula -- [options] <file> [file...]
  npm run analyze:formula -- --stdin --file-type <ufm|ucl|uxf|ulb> [options]

Options:
  --format <text|json>              Output format (default: text)
  --encoding <utf8|latin1>          Source encoding (default: utf8)
  --imports <unchecked|exhaustive>  Import checking mode (default: unchecked)
  --search-path <directory>         Add an exhaustive import search root
  --disable <UF identifier>         Disable a structural diagnostic rule
  --fail-on-warning                 Return exit code 1 for warnings
  --timeout-ms <milliseconds>       Per-file worker timeout (default: 120000)
  --path-mode <relative|basename>   Path display mode (default: relative)
  --help                            Show this help

This command performs UF6 structural analysis only. It does not compile or render formulas.`;

const requiredValue = (
  args: readonly string[],
  index: number,
  option: string,
): string => {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Expected a value after ${option}.`);
  }
  return value;
};

const oneOf = <T extends string>(
  value: string,
  values: readonly T[],
  option: string,
): T => {
  if (!values.includes(value as T)) {
    throw new Error(
      `Invalid value '${value}' for ${option}; expected ${values.join(" or ")}.`,
    );
  }
  return value as T;
};

export function parseCliArguments(args: readonly string[]): CliOptions {
  const files: string[] = [];
  const searchPaths: string[] = [];
  const disabledRules: DiagnosticRule[] = [];
  let stdin = false;
  let fileType: FormulaFileType | undefined;
  let format: OutputFormat = "text";
  let encoding: SourceEncoding = "utf8";
  let importMode: ImportMode = "unchecked";
  let failOnWarnings = false;
  let timeoutMilliseconds = 120_000;
  let pathMode: PathMode = "relative";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--help") {
      throw new Error(usage);
    }
    if (argument === "--stdin") {
      stdin = true;
      continue;
    }
    if (argument === "--fail-on-warning") {
      failOnWarnings = true;
      continue;
    }
    if (argument === "--file-type") {
      const value = requiredValue(args, index, argument);
      fileType = oneOf<FormulaFileType>(
        value,
        ["ufm", "ucl", "uxf", "ulb"],
        argument,
      );
      index += 1;
      continue;
    }
    if (argument === "--format") {
      format = oneOf(
        requiredValue(args, index, argument),
        ["text", "json"],
        argument,
      );
      index += 1;
      continue;
    }
    if (argument === "--encoding") {
      encoding = oneOf(
        requiredValue(args, index, argument),
        ["utf8", "latin1"],
        argument,
      );
      index += 1;
      continue;
    }
    if (argument === "--imports") {
      importMode = oneOf(
        requiredValue(args, index, argument),
        ["unchecked", "exhaustive"],
        argument,
      );
      index += 1;
      continue;
    }
    if (argument === "--search-path") {
      searchPaths.push(requiredValue(args, index, argument));
      index += 1;
      continue;
    }
    if (argument === "--disable") {
      const value = requiredValue(args, index, argument);
      if (!diagnosticRules.has(value)) {
        throw new Error(`Unknown diagnostic rule '${value}'.`);
      }
      disabledRules.push(value as DiagnosticRule);
      index += 1;
      continue;
    }
    if (argument === "--timeout-ms") {
      const value = Number(requiredValue(args, index, argument));
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error("--timeout-ms must be a positive integer.");
      }
      timeoutMilliseconds = value;
      index += 1;
      continue;
    }
    if (argument === "--path-mode") {
      pathMode = oneOf(
        requiredValue(args, index, argument),
        ["relative", "basename"],
        argument,
      );
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`Unknown option '${argument}'.`);
    }
    files.push(argument);
  }

  if (stdin && files.length > 0) {
    throw new Error("--stdin cannot be combined with file paths.");
  }
  if (!stdin && files.length === 0) {
    throw new Error(`No input files were provided.\n\n${usage}`);
  }
  if (stdin && fileType === undefined) {
    throw new Error("--stdin requires --file-type.");
  }
  if (!stdin && fileType !== undefined) {
    throw new Error("--file-type is only valid with --stdin.");
  }
  if (
    stdin &&
    importMode === "exhaustive" &&
    searchPaths.length === 0
  ) {
    throw new Error(
      "Exhaustive import checking for stdin requires at least one --search-path.",
    );
  }

  return {
    files,
    stdin,
    ...(fileType === undefined ? {} : { fileType }),
    format,
    encoding,
    importMode,
    searchPaths,
    disabledRules: [...new Set(disabledRules)],
    failOnWarnings,
    timeoutMilliseconds,
    pathMode,
  };
}

const fileTypeForPath = (filePath: string): FormulaFileType => {
  const extension = path.extname(filePath).slice(1).toLocaleLowerCase("en-US");
  if (!supportedFileTypes.has(extension as FormulaFileType)) {
    throw new Error(
      `Unsupported formula file type for '${filePath}'; expected .ufm, .ucl, .uxf, or .ulb.`,
    );
  }
  return extension as FormulaFileType;
};

const decodeSource = (
  buffer: Buffer,
  encoding: SourceEncoding,
  displayPath: string,
): string => {
  if (encoding === "latin1") {
    return buffer.toString("latin1");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error(
      `Source '${displayPath}' is not valid UTF-8; retry with --encoding latin1 if appropriate.`,
    );
  }
};

class TimeoutCancellation implements CancellationLike {
  private readonly listeners = new Set<() => void>();
  public isCancellationRequested = false;

  public onCancellationRequested(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  public cancel(): void {
    if (this.isCancellationRequested) {
      return;
    }
    this.isCancellationRequested = true;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const displayPath = (
  requestedPath: string,
  absolutePath: string,
  mode: PathMode,
): string => {
  if (mode === "basename") {
    return path.basename(absolutePath);
  }
  const relative = path.relative(process.cwd(), absolutePath);
  return relative.length > 0 ? relative : requestedPath;
};

const uniquePaths = (values: readonly string[]): readonly string[] => [
  ...new Set(values.map((value) => path.resolve(value))),
];

const analyzeSource = async (
  source: string,
  fileType: FormulaFileType,
  roots: readonly string[],
  options: CliOptions,
  sourceName: string,
): Promise<{
  readonly diagnostics: readonly Diagnostic[];
  readonly definitions: readonly AnalysisDefinitionSummary[];
}> => {
  const cancellation = new TimeoutCancellation();
  const timeout = setTimeout(
    () => cancellation.cancel(),
    options.timeoutMilliseconds,
  );
  try {
    return await runAnalysisDetailsInWorker(
      {
        source,
        fileType,
        roots,
        disabledRules: options.disabledRules,
      },
      cancellation,
    );
  } catch (error: unknown) {
    if (error instanceof AnalysisCancelledError) {
      throw new Error(
        `Structural analysis timed out after ${String(options.timeoutMilliseconds)} ms for '${sourceName}'.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const analyzeFile = async (
  requestedPath: string,
  options: CliOptions,
): Promise<FileReport> => {
  const absolutePath = path.resolve(requestedPath);
  const reportPath = displayPath(requestedPath, absolutePath, options.pathMode);
  const fileType = fileTypeForPath(absolutePath);
  const source = decodeSource(
    readFileSync(absolutePath),
    options.encoding,
    reportPath,
  );
  const roots =
    options.importMode === "exhaustive"
      ? uniquePaths([path.dirname(absolutePath), ...options.searchPaths])
      : [];
  const { diagnostics, definitions } = await analyzeSource(
    source,
    fileType,
    roots,
    options,
    reportPath,
  );
  return {
    path: reportPath,
    fileType,
    encoding: options.encoding,
    definitions,
    diagnostics,
  };
};

const analyzeStdin = async (
  options: CliOptions,
  input: Buffer,
): Promise<FileReport> => {
  const fileType = options.fileType;
  if (fileType === undefined) {
    throw new Error("--stdin requires --file-type.");
  }
  const source = decodeSource(input, options.encoding, "<stdin>");
  const roots =
    options.importMode === "exhaustive"
      ? uniquePaths(options.searchPaths)
      : [];
  const { diagnostics, definitions } = await analyzeSource(
    source,
    fileType,
    roots,
    options,
    "<stdin>",
  );
  return {
    path: "<stdin>",
    fileType,
    encoding: options.encoding,
    definitions,
    diagnostics,
  };
};

const createReport = (files: readonly FileReport[]): CliReport => {
  let errors = 0;
  let warnings = 0;
  for (const file of files) {
    for (const diagnostic of file.diagnostics) {
      if (diagnostic.severity === "error") {
        errors += 1;
      } else {
        warnings += 1;
      }
    }
  }
  return {
    schemaVersion: 1,
    target: "UF6",
    validationLevel: "structural",
    compiled: false,
    rendered: false,
    files,
    summary: {
      files: files.length,
      errors,
      warnings,
    },
  };
};

const formatText = (report: CliReport): string => {
  const lines: string[] = [];
  for (const file of report.files) {
    if (file.diagnostics.length === 0) {
      lines.push(
        `${file.path}: structurally clean for UF6; compilation and rendering not tested.`,
      );
      continue;
    }
    for (const diagnostic of file.diagnostics) {
      const line = diagnostic.range.start.line + 1;
      const character = diagnostic.range.start.character + 1;
      lines.push(
        `${file.path}:${String(line)}:${String(character)}: ${diagnostic.severity} ${diagnostic.rule}: ${diagnostic.message}`,
      );
    }
  }
  lines.push(
    `Structural summary: ${String(report.summary.files)} file(s), ${String(report.summary.errors)} error(s), ${String(report.summary.warnings)} warning(s). UF6 compilation and rendering not tested.`,
  );
  return `${lines.join("\n")}\n`;
};

export async function runCli(
  args: readonly string[],
  stdin: Buffer = Buffer.alloc(0),
): Promise<{ readonly report: CliReport; readonly exitCode: number }> {
  const options = parseCliArguments(args);
  const files: FileReport[] = [];
  if (options.stdin) {
    files.push(await analyzeStdin(options, stdin));
  } else {
    for (const file of options.files) {
      files.push(await analyzeFile(file, options));
    }
  }
  const report = createReport(files);
  const exitCode =
    report.summary.errors > 0 ||
    (options.failOnWarnings && report.summary.warnings > 0)
      ? 1
      : 0;
  return { report, exitCode };
}

const main = async (): Promise<void> => {
  try {
    const args = process.argv.slice(2);
    if (args.includes("--help")) {
      process.stdout.write(`${usage}\n`);
      return;
    }
    const input = args.includes("--stdin") ? readFileSync(0) : Buffer.alloc(0);
    const options = parseCliArguments(args);
    const { report, exitCode } = await runCli(args, input);
    process.stdout.write(
      options.format === "json"
        ? `${JSON.stringify(report, null, 2)}\n`
        : formatText(report),
    );
    process.exitCode = exitCode;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`uf-analyze: ${message}\n`);
    process.exitCode = 2;
  }
};

if (require.main === module) {
  void main();
}
