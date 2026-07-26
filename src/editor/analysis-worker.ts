import { parentPort, workerData } from "node:worker_threads";

import { analyze } from "../analyzer";
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from "./analysis-service";
import { resolveImportPath } from "./imports";

const respond = (response: AnalysisWorkerResponse): void => {
  if (parentPort === null) {
    throw new Error("Analysis worker has no parent port");
  }
  parentPort.postMessage(response);
};

try {
  const request = workerData as AnalysisWorkerRequest;
  const result = analyze(request.source, {
    fileType: request.fileType,
    disabledRules: request.disabledRules,
    resolveImport: (importPath) =>
      resolveImportPath(importPath, request.roots).status,
  });
  respond({
    ok: true,
    diagnostics: result.diagnostics,
    definitions: result.program.definitions.map(
      ({ kind, name, nameRange }) => ({ kind, name, nameRange }),
    ),
  });
} catch (error: unknown) {
  respond({
    ok: false,
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  });
}
