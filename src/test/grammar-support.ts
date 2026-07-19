import { readFileSync } from "node:fs";
import path from "node:path";

import {
  INITIAL,
  Registry,
  parseRawGrammar,
  type IGrammar,
  type StateStack,
} from "vscode-textmate";
import {
  createOnigScanner,
  createOnigString,
  loadWASM,
} from "vscode-oniguruma";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const GRAMMAR_PATH = path.join(
  PROJECT_ROOT,
  "syntaxes/ultra-fractal.tmLanguage.json",
);
const SCOPE_NAME = "source.ultra-fractal";

let wasmReady: Promise<void> | undefined;

const ensureWasm = (): Promise<void> => {
  wasmReady ??= loadWASM(
    readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")),
  );
  return wasmReady;
};

export interface ScopeToken {
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly scopes: readonly string[];
}

export interface ScopeSnapshotToken {
  readonly line: number;
  readonly text: string;
  readonly scope: string;
}

export async function loadUltraFractalGrammar(): Promise<IGrammar> {
  await ensureWasm();

  const registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
    loadGrammar: (scopeName) => {
      if (scopeName !== SCOPE_NAME) {
        return Promise.resolve(null);
      }
      return Promise.resolve(
        parseRawGrammar(readFileSync(GRAMMAR_PATH, "utf8"), GRAMMAR_PATH),
      );
    },
  });
  const grammar = await registry.loadGrammar(SCOPE_NAME);
  if (grammar === null) {
    throw new Error(`Unable to load TextMate grammar ${SCOPE_NAME}`);
  }
  return grammar;
}

export function tokenizeForSnapshot(
  grammar: IGrammar,
  source: string,
): ScopeToken[] {
  const lines = source.split(/\r\n|\n|\r/);
  const snapshot: ScopeToken[] = [];
  let ruleStack: StateStack = INITIAL;

  for (const [lineIndex, lineText] of lines.entries()) {
    const result = grammar.tokenizeLine(lineText, ruleStack);
    ruleStack = result.ruleStack;

    for (const token of result.tokens) {
      const text = lineText.slice(token.startIndex, token.endIndex);
      const specificScopes = token.scopes.filter(
        (scope) => scope !== SCOPE_NAME,
      );
      if (text.trim().length === 0 || specificScopes.length === 0) {
        continue;
      }
      snapshot.push({
        line: lineIndex + 1,
        start: token.startIndex,
        end: token.endIndex,
        text,
        scopes: specificScopes,
      });
    }
  }

  return snapshot;
}

export function firstTokenForEachScope(
  tokens: readonly ScopeToken[],
): ScopeSnapshotToken[] {
  const seen = new Set<string>();
  const snapshot: ScopeSnapshotToken[] = [];

  for (const token of tokens) {
    const scope = token.scopes.at(-1);
    if (scope === undefined || seen.has(scope)) {
      continue;
    }
    seen.add(scope);
    snapshot.push({ line: token.line, text: token.text, scope });
  }

  return snapshot;
}
