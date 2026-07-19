import path from "node:path";
import { performance } from "node:perf_hooks";

import * as vscode from "vscode";

import {
  analyze,
  type AnalysisOptions,
  type AnalysisResult,
  type FormulaFileType,
  type ImportResolution,
} from "../analyzer";
import { importSearchRoots, resolveImportPath } from "./imports";
import {
  disabledDiagnosticRules,
  normalizeValidationSettings,
  selectDisplayDiagnostics,
  type DisplaySeverity,
  type ValidationSettings,
} from "./validation";

type Analyzer = (source: string, options: AnalysisOptions) => AnalysisResult;

export interface DiagnosticsControllerDependencies {
  readonly analyzeSource?: Analyzer;
}

export interface ValidationDebugState {
  readonly generation: number;
  readonly pending: boolean;
  readonly startedRuns: number;
  readonly discardedRuns: number;
  readonly publishedVersion?: number;
}

interface MutableValidationDebugState {
  generation: number;
  startedRuns: number;
  discardedRuns: number;
  publishedVersion?: number;
}

const supportedFileTypes = new Set<FormulaFileType>([
  "ufm",
  "ucl",
  "uxf",
  "ulb",
]);

const vscodeSeverities: Readonly<Record<DisplaySeverity, vscode.DiagnosticSeverity>> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

export const isUltraFractalDocument = (
  document: vscode.TextDocument,
): boolean => document.languageId === "ultra-fractal";

export function formulaFileType(document: vscode.TextDocument): FormulaFileType {
  const extension = path.extname(document.fileName).slice(1).toLocaleLowerCase("en-US");
  if (supportedFileTypes.has(extension as FormulaFileType)) {
    return extension as FormulaFileType;
  }

  const source = document.getText();
  if (/^\s*class\s+/imu.test(source)) {
    return "ulb";
  }
  if (/^\s*final\s*:/imu.test(source)) {
    return "ucl";
  }
  if (/^\s*transform\s*:/imu.test(source)) {
    return "uxf";
  }
  return "ufm";
}

export function validationSettingsFor(
  document: vscode.TextDocument,
): ValidationSettings {
  const configuration = vscode.workspace.getConfiguration(
    "ultraFractal",
    document.uri,
  );
  return normalizeValidationSettings({
    enabled: configuration.get("lint.enabled"),
    debounceMilliseconds: configuration.get("lint.debounceMilliseconds"),
    maxDiagnostics: configuration.get("lint.maxDiagnostics"),
    severityOverrides: configuration.get("lint.severityOverrides"),
    formulaSearchPaths: configuration.get("formulaSearchPaths"),
  });
}

export const importRootsForDocument = (
  document: vscode.TextDocument,
  settings: ValidationSettings,
): readonly string[] =>
  importSearchRoots({
    documentPath:
      document.uri.scheme === "untitled" ? undefined : document.uri.fsPath,
    workspaceRoots:
      vscode.workspace.workspaceFolders?.map(({ uri }) => uri.fsPath) ?? [],
    configuredPaths: settings.formulaSearchPaths,
  });

const toVscodeRange = (
  document: vscode.TextDocument,
  startOffset: number,
  endOffset: number,
): vscode.Range =>
  new vscode.Range(
    document.positionAt(startOffset),
    document.positionAt(endOffset),
  );

const diagnosticForVscode = (
  document: vscode.TextDocument,
  diagnostic: ReturnType<typeof selectDisplayDiagnostics>[number],
): vscode.Diagnostic => {
  const result = new vscode.Diagnostic(
    toVscodeRange(
      document,
      diagnostic.range.start.offset,
      diagnostic.range.end.offset,
    ),
    diagnostic.message,
    vscodeSeverities[diagnostic.displaySeverity],
  );
  result.code = diagnostic.rule;
  result.source = "Ultra Fractal";
  return result;
};

export class UltraFractalDiagnosticsController implements vscode.Disposable {
  private readonly analyzeSource: Analyzer;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly cancellations = new Map<
    string,
    vscode.CancellationTokenSource
  >();
  private readonly states = new Map<string, MutableValidationDebugState>();

  public constructor(
    private readonly collection: vscode.DiagnosticCollection,
    private readonly output: vscode.OutputChannel,
    dependencies: DiagnosticsControllerDependencies = {},
  ) {
    this.analyzeSource = dependencies.analyzeSource ?? analyze;
  }

  public start(): void {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        this.schedule(document, "open", 0);
      }),
      vscode.workspace.onDidChangeTextDocument(({ document }) => {
        this.schedule(document, "change");
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        void this.validateNow(document, "save");
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.handleDocumentClosed(document);
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("ultraFractal")) {
          this.revalidateOpenDocuments("configuration");
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.revalidateOpenDocuments("workspace folders");
      }),
    );

    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{ufm,ucl,uxf,ulb}",
    );
    watcher.onDidCreate(() => this.revalidateOpenDocuments("import created"));
    watcher.onDidDelete(() => this.revalidateOpenDocuments("import deleted"));
    this.disposables.push(watcher);

    for (const document of vscode.workspace.textDocuments) {
      this.schedule(document, "activation", 0);
    }
    this.output.appendLine("Ultra Fractal analyzer activated.");
  }

  public schedule(
    document: vscode.TextDocument,
    reason: string,
    requestedDelay?: number,
  ): void {
    if (!isUltraFractalDocument(document)) {
      return;
    }
    const settings = validationSettingsFor(document);
    if (!settings.enabled) {
      this.clearDocument(document.uri);
      return;
    }

    const key = document.uri.toString();
    const generation = this.nextGeneration(key);
    this.cancelPending(key);
    const delay = requestedDelay ?? settings.debounceMilliseconds;
    const timer = setTimeout(() => {
      this.timers.delete(key);
      void this.performValidation(document, generation, reason);
    }, delay);
    this.timers.set(key, timer);
  }

  public async validateNow(
    document: vscode.TextDocument,
    reason = "manual",
  ): Promise<number | undefined> {
    if (!isUltraFractalDocument(document)) {
      return undefined;
    }
    const key = document.uri.toString();
    const generation = this.nextGeneration(key);
    this.cancelPending(key);
    return this.performValidation(document, generation, reason);
  }

  public getValidationState(uri: vscode.Uri): ValidationDebugState {
    const key = uri.toString();
    const state = this.stateFor(key);
    return {
      generation: state.generation,
      pending: this.timers.has(key) || this.cancellations.has(key),
      startedRuns: state.startedRuns,
      discardedRuns: state.discardedRuns,
      ...(state.publishedVersion === undefined
        ? {}
        : { publishedVersion: state.publishedVersion }),
    };
  }

  public handleDocumentClosed(document: vscode.TextDocument): void {
    this.clearDocument(document.uri);
    this.states.delete(document.uri.toString());
  }

  public dispose(): void {
    for (const key of [...this.timers.keys(), ...this.cancellations.keys()]) {
      this.cancelPending(key);
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }

  private stateFor(key: string): MutableValidationDebugState {
    let state = this.states.get(key);
    if (state === undefined) {
      state = {
        generation: 0,
        startedRuns: 0,
        discardedRuns: 0,
      };
      this.states.set(key, state);
    }
    return state;
  }

  private nextGeneration(key: string): number {
    const state = this.stateFor(key);
    state.generation += 1;
    return state.generation;
  }

  private cancelPending(key: string): void {
    const timer = this.timers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    const cancellation = this.cancellations.get(key);
    if (cancellation !== undefined) {
      cancellation.cancel();
      cancellation.dispose();
      this.cancellations.delete(key);
    }
  }

  private clearDocument(uri: vscode.Uri): void {
    const key = uri.toString();
    this.nextGeneration(key);
    this.cancelPending(key);
    this.collection.delete(uri);
  }

  private revalidateOpenDocuments(reason: string): void {
    for (const document of vscode.workspace.textDocuments) {
      if (!isUltraFractalDocument(document)) {
        continue;
      }
      const settings = validationSettingsFor(document);
      if (settings.enabled) {
        this.schedule(document, reason, 0);
      } else {
        this.clearDocument(document.uri);
      }
    }
  }

  private async performValidation(
    document: vscode.TextDocument,
    generation: number,
    reason: string,
  ): Promise<number | undefined> {
    const key = document.uri.toString();
    const state = this.stateFor(key);
    if (state.generation !== generation) {
      state.discardedRuns += 1;
      return undefined;
    }

    const settings = validationSettingsFor(document);
    if (!settings.enabled) {
      this.collection.delete(document.uri);
      return 0;
    }

    const cancellation = new vscode.CancellationTokenSource();
    this.cancellations.set(key, cancellation);
    state.startedRuns += 1;
    const version = document.version;
    const source = document.getText();
    const started = performance.now();

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (cancellation.token.isCancellationRequested) {
        state.discardedRuns += 1;
        return undefined;
      }

      const roots = importRootsForDocument(document, settings);
      const resolveImport = (importPath: string): ImportResolution =>
        resolveImportPath(importPath, roots).status;
      const result = this.analyzeSource(source, {
        fileType: formulaFileType(document),
        disabledRules: disabledDiagnosticRules(settings),
        resolveImport,
      });

      if (
        cancellation.token.isCancellationRequested ||
        state.generation !== generation ||
        document.version !== version
      ) {
        state.discardedRuns += 1;
        return undefined;
      }

      const selected = selectDisplayDiagnostics(result.diagnostics, settings);
      this.collection.set(
        document.uri,
        selected.map((diagnostic) => diagnosticForVscode(document, diagnostic)),
      );
      state.publishedVersion = version;
      const truncated = result.diagnostics.length > selected.length;
      this.output.appendLine(
        `Validated ${document.uri.toString()} v${String(version)} (${reason}): ${String(selected.length)} diagnostic${selected.length === 1 ? "" : "s"}${truncated ? `, limited from ${String(result.diagnostics.length)}` : ""} in ${(performance.now() - started).toFixed(1)} ms.`,
      );
      return selected.length;
    } catch (error: unknown) {
      if (state.generation === generation) {
        this.collection.delete(document.uri);
      }
      const detail =
        error instanceof Error ? error.stack ?? error.message : String(error);
      this.output.appendLine(
        `Analyzer failure for ${document.uri.toString()} (${reason}): ${detail}`,
      );
      return undefined;
    } finally {
      if (this.cancellations.get(key) === cancellation) {
        this.cancellations.delete(key);
      }
      cancellation.dispose();
    }
  }
}
