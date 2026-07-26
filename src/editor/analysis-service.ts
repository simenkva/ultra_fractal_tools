import path from "node:path";
import { Worker } from "node:worker_threads";

import type {
  Diagnostic,
  DiagnosticRule,
  FormulaFileType,
  SourceRange,
} from "../analyzer";

export interface AnalysisWorkerRequest {
  readonly source: string;
  readonly fileType: FormulaFileType;
  readonly roots: readonly string[];
  readonly disabledRules?: readonly DiagnosticRule[];
}

export interface AnalysisDefinitionSummary {
  readonly kind: "entry" | "class";
  readonly name: string;
  readonly nameRange: SourceRange;
}

export interface AnalysisWorkerResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly definitions: readonly AnalysisDefinitionSummary[];
}

export type AnalysisWorkerResponse =
  | {
      readonly ok: true;
      readonly diagnostics: readonly Diagnostic[];
      readonly definitions: readonly AnalysisDefinitionSummary[];
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export interface CancellationLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(
    listener: () => void,
  ): { dispose(): void };
}

export type AnalysisRunner = (
  request: AnalysisWorkerRequest,
  cancellation: CancellationLike,
) => Promise<readonly Diagnostic[]>;

export type AnalysisDetailsRunner = (
  request: AnalysisWorkerRequest,
  cancellation: CancellationLike,
) => Promise<AnalysisWorkerResult>;

export class AnalysisCancelledError extends Error {
  public constructor() {
    super("Ultra Fractal analysis was cancelled");
    this.name = "AnalysisCancelledError";
  }
}

export const runAnalysisDetailsInWorker: AnalysisDetailsRunner = (
  request,
  cancellation,
) =>
  new Promise((resolve, reject) => {
    if (cancellation.isCancellationRequested) {
      reject(new AnalysisCancelledError());
      return;
    }

    const worker = new Worker(path.join(__dirname, "analysis-worker.js"), {
      workerData: request,
      resourceLimits: {
        maxOldGenerationSizeMb: 768,
        maxYoungGenerationSizeMb: 64,
      },
    });
    let settled = false;
    const cancellationSubscription = cancellation.onCancellationRequested(
      () => {
        if (settled) {
          return;
        }
        settled = true;
        void worker.terminate();
        reject(new AnalysisCancelledError());
      },
    );
    const settle = (
      action: () => void,
      terminateWorker = false,
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      cancellationSubscription.dispose();
      if (terminateWorker) {
        void worker.terminate();
      }
      action();
    };

    worker.once("message", (response: AnalysisWorkerResponse) => {
      if (response.ok) {
        settle(
          () =>
            resolve({
              diagnostics: response.diagnostics,
              definitions: response.definitions,
            }),
          true,
        );
      } else {
        settle(() => reject(new Error(response.error)), true);
      }
    });
    worker.once("error", (error) => {
      settle(() => reject(error));
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        settle(
          () =>
            reject(
              new Error(`Ultra Fractal analysis worker exited with ${String(code)}`),
            ),
        );
      } else {
        settle(() => reject(new Error("Analysis worker returned no result")));
      }
    });
  });

export const runAnalysisInWorker: AnalysisRunner = async (
  request,
  cancellation,
) => (await runAnalysisDetailsInWorker(request, cancellation)).diagnostics;
