import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from "node:worker_threads";

import { INITIAL, type StateStack } from "vscode-textmate";

import { loadUltraFractalGrammar } from "./grammar-support";

const projectRoot = path.resolve(__dirname, "../..");
const benchmarkFiles = [
  "uf-formulas/reb.ucl",
  "uf-formulas/as.ufm",
  "uf-formulas/tma3.ufm",
] as const;

interface BenchmarkResult {
  readonly relativePath: string;
  readonly lines: number;
  readonly tokens: number;
  readonly milliseconds: number;
}

async function benchmarkFile(relativePath: string): Promise<BenchmarkResult> {
  const grammar = await loadUltraFractalGrammar();
  const source = readFileSync(path.join(projectRoot, relativePath), "latin1");
  const lines = source.split(/\r\n|\n|\r/);
  let ruleStack: StateStack = INITIAL;
  let tokenCount = 0;
  const started = performance.now();

  for (const line of lines) {
    const result = grammar.tokenizeLine(line, ruleStack, 2_000);
    assert.equal(result.stoppedEarly, false, `${relativePath} timed out`);
    ruleStack = result.ruleStack;
    tokenCount += result.tokens.length;
  }

  return {
    relativePath,
    lines: lines.length,
    tokens: tokenCount,
    milliseconds: performance.now() - started,
  };
}

function runWorker(relativePath: string): Promise<BenchmarkResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: relativePath });
    worker.once("message", (result: BenchmarkResult) => resolve(result));
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`${relativePath} benchmark worker exited with ${code}`));
      }
    });
  });
}

async function main(): Promise<void> {
  if (!isMainThread) {
    const result = await benchmarkFile(workerData as string);
    if (parentPort === null) {
      throw new Error("Benchmark worker has no parent port");
    }
    parentPort.postMessage(result);
    return;
  }

  const wallStarted = performance.now();
  const results = await Promise.all(benchmarkFiles.map(runWorker));
  for (const result of results) {
    console.log(
      `${result.relativePath}: ${result.lines.toLocaleString("en-US")} lines, ${result.tokens.toLocaleString("en-US")} tokens, ${result.milliseconds.toFixed(1)} ms`,
    );
  }
  const wallMilliseconds = performance.now() - wallStarted;
  const totalMilliseconds = results.reduce(
    (total, result) => total + result.milliseconds,
    0,
  );
  const totalLines = results.reduce((total, result) => total + result.lines, 0);
  console.log(
    `Total: ${totalLines.toLocaleString("en-US")} lines in ${wallMilliseconds.toFixed(1)} ms wall time (${totalMilliseconds.toFixed(1)} ms combined worker time)`,
  );
  assert.ok(
    wallMilliseconds < 60_000,
    `Grammar benchmark exceeded 60 seconds (${wallMilliseconds.toFixed(1)} ms)`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
