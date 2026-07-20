import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { analyzeCorpusPath, type CorpusFileResult } from "./corpus-scan";

const projectRoot = path.resolve(__dirname, "../..");
const typicalFiles = [
  "uf-formulas/jh.ufm",
  "uf-formulas/pdf.ucl",
  "uf-formulas/raf.uxf",
] as const;
const largestFiles = [
  "uf-formulas/reb.ucl",
  "uf-formulas/as.ufm",
  "uf-formulas/tma3.ufm",
  "uf-formulas/jam.ucl",
  "uf-formulas/reb.ulb",
] as const;
const typicalFileBudgetMilliseconds = 2_000;
const largeFileBudgetMilliseconds = 15_000;
const combinedLargeFileBudgetMilliseconds = 45_000;
const largeFileHeapBudgetBytes = 768 * 1024 * 1024;

const measure = async (
  relativePaths: readonly string[],
  perFileBudget: number,
): Promise<readonly CorpusFileResult[]> => {
  const results: CorpusFileResult[] = [];
  for (const relativePath of relativePaths) {
    const result = await analyzeCorpusPath(relativePath, perFileBudget);
    assert.ok(
      result.milliseconds < perFileBudget,
      `${relativePath} exceeded ${String(perFileBudget)} ms`,
    );
    results.push(result);
  }
  return results;
};

const logResult = (label: string, result: CorpusFileResult): void => {
  console.log(
    `${label}: ${result.path} — ${result.lines.toLocaleString("en-US")} lines, ${result.bytes.toLocaleString("en-US")} bytes, ${result.milliseconds.toFixed(1)} ms, ${Math.round(result.heapUsedBytes / 1024 / 1024)} MiB heap`,
  );
};

const main = async (): Promise<void> => {
  if (!existsSync(path.join(projectRoot, "uf-formulas"))) {
    console.log("SKIP: optional uf-formulas corpus is absent.");
    return;
  }

  console.log(
    `Environment: Node ${process.version}, ${process.platform}/${process.arch}, ${String(os.cpus().length)} logical CPUs, ${Math.round(os.totalmem() / 1024 / 1024)} MiB RAM`,
  );
  const typical = await measure(
    typicalFiles,
    typicalFileBudgetMilliseconds,
  );
  for (const result of typical) {
    logResult("Typical", result);
  }

  const largeStarted = performance.now();
  const large = await measure(largestFiles, largeFileBudgetMilliseconds);
  const combinedLargeMilliseconds = performance.now() - largeStarted;
  for (const result of large) {
    logResult("Large", result);
    assert.ok(
      result.heapUsedBytes < largeFileHeapBudgetBytes,
      `${result.path} exceeded the 768 MiB heap budget`,
    );
  }
  assert.ok(
    combinedLargeMilliseconds < combinedLargeFileBudgetMilliseconds,
    `combined large-file benchmark exceeded ${String(combinedLargeFileBudgetMilliseconds)} ms`,
  );
  console.log(
    `Large-file wall time: ${combinedLargeMilliseconds.toFixed(1)} ms (budget ${String(combinedLargeFileBudgetMilliseconds)} ms).`,
  );
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
