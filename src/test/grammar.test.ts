import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { UF6_CATALOG } from "../catalog/uf6";
import {
  firstTokenForEachScope,
  loadUltraFractalGrammar,
  tokenizeForSnapshot,
  type ScopeToken,
  type ScopeSnapshotToken,
} from "./grammar-support";

const projectRoot = path.resolve(__dirname, "../..");
const grammarRoot = path.join(projectRoot, "test/grammar");

const loadFixture = (name: string): string =>
  readFileSync(path.join(grammarRoot, name), "utf8");

const hasScope = (token: ScopeToken, scope: string): boolean =>
  token.scopes.includes(scope);

const requireToken = (
  tokens: readonly ScopeToken[],
  text: string,
  scope: string,
): ScopeToken => {
  const token = tokens.find(
    (candidate) => candidate.text === text && hasScope(candidate, scope),
  );
  assert.ok(token, `Expected ${JSON.stringify(text)} to have scope ${scope}`);
  return token;
};

void test("grammar covers all required M1 token classes without scope leaks", async () => {
  const grammar = await loadUltraFractalGrammar();
  const tokens = tokenizeForSnapshot(grammar, loadFixture("syntax-cases.ufm"));

  requireToken(
    tokens,
    "  <p>Documentation with { braces }, ; semicolons, and \"quotes\".</p>",
    "comment.block.documentation.ultra-fractal",
  );
  const entry = requireToken(
    tokens,
    "My-Formula",
    "entity.name.function.formula.ultra-fractal",
  );
  assert.ok(!entry.scopes.some((scope) => scope.startsWith("comment.")));

  requireToken(tokens, "$IFDEF", "keyword.control.directive.ultra-fractal");
  requireToken(tokens, "global", "keyword.control.section.ultra-fractal");
  requireToken(tokens, "import", "keyword.control.import.ultra-fractal");
  requireToken(tokens, "float", "storage.type.ultra-fractal");
  requireToken(tokens, "1.25e-3", "constant.numeric.float.ultra-fractal");
  requireToken(tokens, "2.0", "meta.number.complex.ultra-fractal");
  requireToken(tokens, "2.5i", "constant.numeric.imaginary.ultra-fractal");
  requireToken(tokens, "@seed", "variable.other.parameter.ultra-fractal");
  requireToken(tokens, "#pixel", "variable.language.predefined.ultra-fractal");
  requireToken(tokens, "isNaN", "support.function.builtin.ultra-fractal");
  requireToken(tokens, "false", "constant.language.boolean.ultra-fractal");
  requireToken(tokens, "elseif", "keyword.control.flow.ultra-fractal");
  requireToken(tokens, ".", "punctuation.accessor.ultra-fractal");
  requireToken(tokens, "Calculate", "entity.name.function.member.ultra-fractal");
  requireToken(tokens, "<=", "keyword.operator.ultra-fractal");
  requireToken(
    tokens,
    "\\",
    "constant.character.escape.line-continuation.ultra-fractal",
  );
  requireToken(
    tokens,
    "title",
    "support.type.property-name.setting.ultra-fractal",
  );
  requireToken(tokens, "param", "storage.type.parameter.ultra-fractal");
  requireToken(tokens, "bailout", "variable.parameter.declaration.ultra-fractal");
  requireToken(tokens, "transform", "variable.parameter.function.ultra-fractal");
  requireToken(tokens, ":", "keyword.control.section.legacy.ultra-fractal");

  const inlineComment = tokens.find(
    (token) =>
      token.line === 15 &&
      hasScope(token, "comment.line.semicolon.ultra-fractal"),
  );
  assert.ok(inlineComment, "inline comment must include quotes and braces");
  const followingElseIf = tokens.find(
    (token) => token.line === 16 && token.text === "elseif",
  );
  assert.ok(followingElseIf);
  assert.ok(
    !followingElseIf.scopes.some(
      (scope) => scope.startsWith("comment.") || scope.startsWith("string."),
    ),
    "comments and strings must not leak onto the next line",
  );

  const continuedText = tokens.find(
    (token) => token.line === 25 && token.text.includes("and another line"),
  );
  assert.ok(continuedText, "continued string text must be tokenized");
  assert.ok(
    hasScope(continuedText, "string.quoted.double.ultra-fractal"),
    "backslash continuation must preserve string state on the next line",
  );

  const unclosed = tokenizeForSnapshot(
    grammar,
    'title = "unfinished\ndefault:\n',
  );
  const followingSection = requireToken(
    unclosed,
    "default",
    "keyword.control.section.ultra-fractal",
  );
  assert.ok(
    !followingSection.scopes.some((scope) => scope.startsWith("string.")),
    "an unclosed ordinary string must end at the physical line boundary",
  );
});

void test("all catalogued built-ins and directives tokenize case-insensitively", async () => {
  const grammar = await loadUltraFractalGrammar();
  const calls = UF6_CATALOG.builtInFunctions.values
    .map((name) => `${name.toLocaleUpperCase("en-US")}()`)
    .join(" ");
  const functionTokens = tokenizeForSnapshot(grammar, calls);

  for (const name of UF6_CATALOG.builtInFunctions.values) {
    requireToken(
      functionTokens,
      name.toLocaleUpperCase("en-US"),
      "support.function.builtin.ultra-fractal",
    );
  }

  const directives = UF6_CATALOG.compilerDirectives.values
    .map((name) => name.toLocaleUpperCase("en-US"))
    .join("\n");
  const directiveTokens = tokenizeForSnapshot(grammar, directives);
  for (const name of UF6_CATALOG.compilerDirectives.values) {
    requireToken(
      directiveTokens,
      name.toLocaleUpperCase("en-US"),
      "keyword.control.directive.ultra-fractal",
    );
  }
});

void test("ordinary identifiers receive a fallback variable scope", async () => {
  const grammar = await loadUltraFractalGrammar();
  const tokens = tokenizeForSnapshot(
    grammar,
    [
      "Fallback {",
      "loop:",
      "  z = analyticPart + realBridge + #pixel",
      "switch:",
      '  type = "Companion"',
      "  power = power",
      "}",
    ].join("\n"),
  );

  for (const identifier of ["z", "analyticPart", "realBridge"]) {
    requireToken(
      tokens,
      identifier,
      "variable.other.readwrite.ultra-fractal",
    );
  }

  const switchPower = tokens.filter(
    (token) =>
      token.line === 6 &&
      token.text === "power" &&
      hasScope(token, "variable.other.readwrite.ultra-fractal"),
  );
  assert.equal(switchPower.length, 2);
  requireToken(
    tokens,
    "type",
    "support.type.property-name.setting.ultra-fractal",
  );
  requireToken(
    tokens,
    "#pixel",
    "variable.language.predefined.ultra-fractal",
  );
});

for (const extension of ["ufm", "ucl", "uxf", "ulb"]) {
  void test(`.${extension} token scopes match the committed snapshot`, async () => {
    const grammar = await loadUltraFractalGrammar();
    const actual = firstTokenForEachScope(
      tokenizeForSnapshot(
        grammar,
        loadFixture(`syntax-cases.${extension}`),
      ),
    );
    const expected = JSON.parse(
      loadFixture(`snapshots/syntax-cases.${extension}.tokens.json`),
    ) as ScopeSnapshotToken[];
    assert.deepEqual(actual, expected);
  });
}
