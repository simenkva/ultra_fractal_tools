import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { indentationAdjustmentAfterNewline } from "../editor/indentation";
import { scanStructure } from "../editor/structure";

interface LanguageConfiguration {
  readonly comments: { readonly lineComment: string };
  readonly brackets: readonly (readonly [string, string])[];
  readonly autoClosingPairs: readonly {
    readonly open: string;
    readonly close: string;
  }[];
  readonly surroundingPairs: readonly (readonly [string, string])[];
  readonly wordPattern: string;
  readonly indentationRules: Readonly<{
    increaseIndentPattern: string;
    decreaseIndentPattern: string;
    unIndentedLinePattern: string;
  }>;
  readonly onEnterRules: readonly {
    readonly beforeText: string;
    readonly action: { readonly indent: string };
  }[];
}

interface Snippet {
  readonly prefix: string;
  readonly body: readonly string[];
}

interface ExtensionManifest {
  readonly files: readonly string[];
  readonly contributes: {
    readonly snippets: readonly {
      readonly language: string;
      readonly path: string;
    }[];
    readonly configurationDefaults: {
      readonly "[ultra-fractal]": {
        readonly "editor.formatOnType": boolean;
      };
    };
  };
}

const projectRoot = path.resolve(__dirname, "../..");
const readText = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");
const readJson = <T>(relativePath: string): T =>
  JSON.parse(readText(relativePath)) as T;

void test("language configuration supports M2 editing behavior", () => {
  const configuration = readJson<LanguageConfiguration>(
    "language-configuration.json",
  );
  assert.equal(configuration.comments.lineComment, ";");
  assert.deepEqual(configuration.brackets, [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ]);
  assert.ok(
    configuration.autoClosingPairs.some(
      ({ open, close }) => open === '"' && close === '"',
    ),
  );
  assert.ok(
    configuration.surroundingPairs.some(
      ([open, close]) => open === '"' && close === '"',
    ),
  );

  const words = "z = @seed + #pixel".match(
    new RegExp(configuration.wordPattern, "gu"),
  );
  assert.deepEqual(words, ["z", "@seed", "#pixel"]);

  const increase = new RegExp(
    configuration.indentationRules.increaseIndentPattern,
    "u",
  );
  const decrease = new RegExp(
    configuration.indentationRules.decreaseIndentPattern,
    "u",
  );
  for (const opener of [
    "Example {",
    "  IF @enabled",
    "  func Calculate()",
    "  param bailout",
    "DeFaUlT:",
  ]) {
    assert.match(opener, increase);
  }
  assert.doesNotMatch("  float scale = 2", increase);
  assert.doesNotMatch("  ; if this is documentation", increase);

  for (const closer of ["}", "  ENDIF", "  endfunc", "DeFaUlT:"]) {
    assert.match(closer, decrease);
  }
  assert.doesNotMatch("  z = sqr(z)", decrease);

  assert.equal(configuration.onEnterRules.length, 2);
  const enterRules = configuration.onEnterRules.map(
    ({ beforeText }) => new RegExp(beforeText, "u"),
  );
  assert.ok(enterRules.some((rule) => rule.test("  IF @enabled")));
  assert.ok(enterRules.some((rule) => rule.test("DeFaUlT:")));
  assert.ok(
    configuration.onEnterRules.every(
      ({ action }) => action.indent === "indent",
    ),
  );
});

void test("M2 snippets are registered, tab-stopped, and structurally complete", () => {
  const manifest = readJson<ExtensionManifest>("package.json");
  assert.deepEqual(manifest.contributes.snippets, [
    {
      language: "ultra-fractal",
      path: "./snippets/ultra-fractal.code-snippets",
    },
  ]);
  assert.ok(manifest.files.includes("snippets/ultra-fractal.code-snippets"));
  assert.equal(
    manifest.contributes.configurationDefaults["[ultra-fractal]"][
      "editor.formatOnType"
    ],
    true,
  );

  const snippets = readJson<Record<string, Snippet>>(
    "snippets/ultra-fractal.code-snippets",
  );
  const prefixes = new Set(
    Object.values(snippets).map((snippet) => snippet.prefix),
  );
  assert.deepEqual(
    prefixes,
    new Set([
      "uf-formula",
      "uf-coloring",
      "uf-transform",
      "uf-class",
      "uf-param",
      "uf-func",
      "uf-if",
    ]),
  );

  for (const [name, snippet] of Object.entries(snippets)) {
    const body = snippet.body.join("\n");
    assert.match(body, /\$\{\d+:/u, `${name} needs a named tab stop`);
    assert.match(body, /\$0/u, `${name} needs a final tab stop`);
  }

  assert.match(snippets["Fractal formula"]?.body.join("\n") ?? "", /bailout:/u);
  assert.match(
    snippets["Coloring algorithm"]?.body.join("\n") ?? "",
    /final:/u,
  );
  assert.match(snippets.Transformation?.body.join("\n") ?? "", /transform:/u);
  assert.match(snippets.Class?.body.join("\n") ?? "", /class .*\{[\s\S]*\}/u);
  assert.match(
    snippets["Parameter block"]?.body.join("\n") ?? "",
    /param [\s\S]*endparam/u,
  );
  assert.match(
    snippets["Function block"]?.body.join("\n") ?? "",
    /func [\s\S]*endfunc/u,
  );
  assert.match(
    snippets["Conditional block"]?.body.join("\n") ?? "",
    /if [\s\S]*endif/u,
  );
});

void test("newline adjustment aligns sections, closers, and following content", () => {
  assert.deepEqual(
    indentationAdjustmentAfterNewline(
      "Example {\n    init:\n        ",
      1,
      "    ",
    ),
    { previousLine: "", nextLine: "    " },
  );
  assert.deepEqual(
    indentationAdjustmentAfterNewline(
      "Example {\ninit:\n    if true\n        z = 0\n        endif\n        ",
      4,
      "    ",
    ),
    { previousLine: "    ", nextLine: "    " },
  );
  assert.deepEqual(
    indentationAdjustmentAfterNewline(
      "Example {\ninit:\n    if true\n        z = 0\n        else\n            ",
      4,
      "    ",
    ),
    { previousLine: "    ", nextLine: "        " },
  );
  assert.deepEqual(
    indentationAdjustmentAfterNewline(
      "Example {\ninit:\n    if true\n        z = 0\n    elseif other\n        z = 1\n        else\n            ",
      6,
      "    ",
    ),
    { previousLine: "    ", nextLine: "        " },
  );
  assert.deepEqual(
    indentationAdjustmentAfterNewline(
      "Example {\ninit:\n    z = 0\n    }\n    ",
      3,
      "    ",
    ),
    { previousLine: "", nextLine: "" },
  );
  assert.equal(
    indentationAdjustmentAfterNewline(
      "Example {\ninit:\n    z = 0\n",
      2,
      "    ",
    ),
    undefined,
  );
});

void test("structure scan creates ordered entry, section, and function symbols", () => {
  const source = readText("test/grammar/syntax-cases.ufm");
  const scan = scanStructure(source);
  assert.deepEqual(
    scan.symbols.map(({ name, kind }) => ({ name, kind })),
    [
      { name: "My-Formula", kind: "entry" },
      { name: "Legacy-Formula", kind: "entry" },
    ],
  );

  const formula = scan.symbols[0];
  assert.ok(formula);
  assert.equal(formula.startLine, 4);
  assert.equal(formula.endLine, 33);
  assert.deepEqual(
    formula.children.map(({ name }) => name),
    ["global", "init", "loop", "bailout", "default"],
  );
  const defaultSection = formula.children.at(-1);
  assert.ok(defaultSection);
  assert.deepEqual(
    defaultSection.children.map(({ name, kind }) => ({ name, kind })),
    [{ name: "transform", kind: "function" }],
  );

  const expectedFolds = [
    [0, 2],
    [4, 33],
    [6, 8],
    [9, 11],
    [12, 19],
    [20, 21],
    [22, 32],
    [26, 29],
    [30, 32],
    [36, 40],
  ];
  assert.deepEqual(
    scan.foldingRegions.map(({ startLine, endLine }) => [startLine, endLine]),
    expectedFolds,
  );
  assert.equal(source, readText("test/grammar/syntax-cases.ufm"));
});

void test("class outline nests visibility sections and methods", () => {
  const scan = scanStructure(readText("test/grammar/syntax-cases.ulb"));
  const classSymbol = scan.symbols[0];
  assert.ok(classSymbol);
  assert.equal(classSymbol.name, "ExamplePlugin");
  assert.equal(classSymbol.kind, "class");
  assert.deepEqual(
    classSymbol.children.map(({ name }) => name),
    ["public", "protected", "private", "default"],
  );
  assert.deepEqual(
    classSymbol.children[0]?.children.map(({ name }) => name),
    ["ExamplePlugin", "Iterate"],
  );
});

void test("coloring and transformation fixtures expose their legal sections", () => {
  const coloring = scanStructure(readText("test/grammar/syntax-cases.ucl"));
  assert.deepEqual(
    coloring.symbols[0]?.children.map(({ name }) => name),
    ["global", "init", "loop", "final", "default"],
  );

  const transformation = scanStructure(
    readText("test/grammar/syntax-cases.uxf"),
  );
  assert.deepEqual(
    transformation.symbols[0]?.children.map(({ name }) => name),
    ["transform", "default"],
  );
  assert.ok(
    transformation.foldingRegions.some(
      ({ startLine, endLine }) => startLine === 6 && endLine === 8,
    ),
    "transformation parameter block must fold",
  );
});
