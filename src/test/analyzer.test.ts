import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  analyze,
  DIAGNOSTIC_RULE_DESCRIPTIONS,
  DIAGNOSTIC_RULES,
  lex,
  parse,
  type DiagnosticRule,
  type FormulaFileType,
} from "../analyzer";

const projectRoot = path.resolve(__dirname, "../..");
const readText = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");
const rules = (source: string, fileType: FormulaFileType): DiagnosticRule[] =>
  analyze(source, { fileType }).diagnostics.map(({ rule }) => rule);

void test("lexer emits every M3 token family with exact source ranges", () => {
  const source = readText("test/analyzer/valid.ufm");
  const result = lex(source);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(
    new Set(result.tokens.map(({ kind }) => kind)),
    new Set([
      "identifier",
      "literal",
      "symbol",
      "comment",
      "directive",
      "newline",
      "line-continuation",
    ]),
  );

  for (const token of result.tokens) {
    assert.equal(
      source.slice(token.range.start.offset, token.range.end.offset),
      token.text,
    );
    assert.ok(token.range.end.offset > token.range.start.offset);
  }
  assert.ok(
    result.tokens.some(
      ({ kind, text }) => kind === "identifier" && text === "@enabled",
    ),
  );
  assert.ok(
    result.tokens.some(
      ({ kind, text }) => kind === "directive" && text === "$ifdef",
    ),
  );
  assert.deepEqual(
    lex("true false").tokens.map(({ kind, text }) => ({ kind, text })),
    [
      { kind: "literal", text: "true" },
      { kind: "literal", text: "false" },
    ],
  );
});

void test("comments and continued strings shield delimiters and keywords", () => {
  const source = `comment {
  } ] ) if endif "ignored"
}
Shielded {
init:
  title = "{[( if \\
           still text"
  z = 1 ; } ] ) endwhile
}
`;
  const result = analyze(source, { fileType: "ufm" });
  assert.deepEqual(result.diagnostics, []);
});

void test("legacy line endings and adjacent quoted fragments lex conservatively", () => {
  const source =
    'Line-Endings {\r\ndefault:\r\n  enum = "\\" "|"\r\n  hint = "Long \\\r\r\n         description"\r\n}\r\n';
  assert.deepEqual(analyze(source, { fileType: "ufm" }).diagnostics, []);
});

void test("valid fixtures for every supported file type have no diagnostics", () => {
  const fixtures: readonly (readonly [string, FormulaFileType])[] = [
    ["test/analyzer/valid.ufm", "ufm"],
    ["test/fixtures/minimal.ufm", "ufm"],
    ["test/fixtures/minimal.ucl", "ucl"],
    ["test/fixtures/minimal.uxf", "uxf"],
    ["test/fixtures/minimal.ulb", "ulb"],
  ];
  for (const [fixture, fileType] of fixtures) {
    assert.deepEqual(
      analyze(readText(fixture), { fileType }).diagnostics,
      [],
      fixture,
    );
  }

  const classInFormulaFile = `class Helper {
public:
  float func Apply(float value)
    return value
  endfunc
private:
  float scale
}
`;
  assert.deepEqual(
    analyze(classInFormulaFile, { fileType: "ufm" }).diagnostics,
    [],
  );
});

void test("parser returns entries, classes, sections, declarations, and nested blocks", () => {
  const formulaSource = readText("test/analyzer/valid.ufm");
  const lexedFormula = lex(formulaSource);
  const formula = parse(formulaSource, lexedFormula.tokens).program.definitions[0];
  assert.ok(formula);
  assert.equal(formula.kind, "entry");
  assert.equal(formula.name, "Analyzer-Sample");
  assert.deepEqual(
    formula.sections.map(({ name }) => name),
    ["global", "init", "loop", "bailout", "default"],
  );
  assert.deepEqual(
    formula.sections[0]?.declarations.map(({ kind, name, importPath }) => ({
      kind,
      name,
      importPath,
    })),
    [
      { kind: "import", name: undefined, importPath: "common.ulb" },
      { kind: "variable", name: "scale", importPath: undefined },
    ],
  );
  const ifBlock = formula.sections[1]?.blocks[0];
  assert.equal(ifBlock?.kind, "if");
  assert.deepEqual(
    ifBlock.children.map(({ kind }) => kind),
    ["while", "repeat"],
  );
  assert.deepEqual(
    formula.sections.at(-1)?.declarations.map(({ kind, name }) => ({ kind, name })),
    [
      { kind: "parameter", name: "limit" },
      { kind: "function", name: "Adjust" },
    ],
  );

  const classSource = readText("test/fixtures/minimal.ulb");
  const classNode = parse(classSource, lex(classSource).tokens).program.definitions[0];
  assert.equal(classNode?.kind, "class");
  assert.equal(classNode?.name, "IdentityPlugin");
  assert.equal(classNode?.sections[0]?.blocks[0]?.kind, "function");
});

void test("incomplete input returns a partial tree and focused closing diagnostics", () => {
  const source = readText("test/analyzer/incomplete.ufm");
  const result = analyze(source, { fileType: "ufm" });
  assert.equal(result.program.definitions[0]?.name, "Incomplete-Formula");
  assert.equal(result.program.definitions[0]?.range.end.offset, source.length);
  assert.deepEqual(
    new Set(result.diagnostics.map(({ rule }) => rule)),
    new Set([
      DIAGNOSTIC_RULES.unterminatedString,
      DIAGNOSTIC_RULES.delimiterMismatch,
      DIAGNOSTIC_RULES.blockMismatch,
    ]),
  );
  for (const diagnostic of result.diagnostics) {
    assert.equal(diagnostic.severity, "error");
    assert.match(diagnostic.message, /expected/iu);
    assert.ok(diagnostic.range.end.offset >= diagnostic.range.start.offset);
  }
});

void test("delimiter and language-block errors identify the expected match", () => {
  const delimiter = analyze("Broken {\ninit:\n  z = 1)\n}\n", {
    fileType: "ufm",
  }).diagnostics;
  assert.equal(delimiter.length, 1);
  assert.equal(delimiter[0]?.rule, DIAGNOSTIC_RULES.delimiterMismatch);
  assert.equal(delimiter[0]?.range.start.character, 7);
  assert.match(delimiter[0]?.message ?? "", /expected.*'\('/iu);

  const blocks = analyze(
    "Broken {\ninit:\n  if true\n    while true\n  endif\n}\n",
    { fileType: "ufm" },
  ).diagnostics.filter(({ rule }) => rule === DIAGNOSTIC_RULES.blockMismatch);
  assert.ok(blocks.length >= 1);
  assert.match(blocks[0]?.message ?? "", /expected 'endwhile'/iu);
  assert.equal(blocks[0]?.range.start.character, 2);
});

void test("compiler directives nest independently from normal control flow", () => {
  const valid = `Independent {
init:
$ifdef A
  if true
$ifdef B
$else
$endif
$else
  endif
$endif
}
`;
  assert.ok(
    !analyze(valid, { fileType: "ufm" }).diagnostics.some(
      ({ rule }) =>
        rule === DIAGNOSTIC_RULES.directiveNesting ||
        rule === DIAGNOSTIC_RULES.blockMismatch,
    ),
  );

  const invalid = `Invalid {
init:
  if true
  endif
$else
$ifdef A
$else
$else
}
`;
  const diagnostics = analyze(invalid, { fileType: "ufm" }).diagnostics;
  const directiveDiagnostics = diagnostics.filter(
    ({ rule }) => rule === DIAGNOSTIC_RULES.directiveNesting,
  );
  assert.equal(directiveDiagnostics.length, 3);
  assert.ok(
    directiveDiagnostics.every(
      ({ severity, message }) => severity === "error" && /expected/iu.test(message),
    ),
  );
  assert.ok(
    !diagnostics.some(({ rule }) => rule === DIAGNOSTIC_RULES.blockMismatch),
  );
});

void test("inline parameter aliases are declarations rather than open blocks", () => {
  const source = `Aliases {
default:
  param inherited = plugin.inherited
}
`;
  const result = analyze(source, { fileType: "ucl" });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.program.definitions[0]?.sections[0]?.declarations.map(
      ({ kind, name }) => ({ kind, name }),
    ),
    [{ kind: "parameter", name: "inherited" }],
  );
});

void test("definition, section, ordering, and parameter rules are case-insensitive", () => {
  const source = `Sample {
loop:
  float param Limit
  endparam
init:
  float param @limit
  endparam
transform:
}
sAmPlE {
init:
}
`;
  const diagnostics = analyze(source, { fileType: "ufm" }).diagnostics;
  assert.deepEqual(
    new Set(diagnostics.map(({ rule }) => rule)),
    new Set([
      DIAGNOSTIC_RULES.duplicateDefinition,
      DIAGNOSTIC_RULES.illegalSection,
      DIAGNOSTIC_RULES.sectionOrder,
      DIAGNOSTIC_RULES.duplicateParameter,
    ]),
  );
  assert.equal(
    diagnostics.find(({ rule }) => rule === DIAGNOSTIC_RULES.duplicateDefinition)
      ?.range.start.line,
    9,
  );
  assert.ok(
    diagnostics
      .filter(({ severity }) => severity === "error")
      .every(({ message }) => /expected/iu.test(message)),
  );
});

void test("missing imports are warned only after an exhaustive resolver result", () => {
  const source = `Imports {
global:
  import "available.ulb"
  import "missing.ulb"
}
`;
  assert.ok(
    !analyze(source, { fileType: "ufm" }).diagnostics.some(
      ({ rule }) => rule === DIAGNOSTIC_RULES.missingImport,
    ),
  );
  assert.ok(
    !analyze(source, {
      fileType: "ufm",
      resolveImport: () => "unchecked",
    }).diagnostics.some(({ rule }) => rule === DIAGNOSTIC_RULES.missingImport),
  );
  const checked = analyze(source, {
    fileType: "ufm",
    resolveImport: (importPath) =>
      importPath === "missing.ulb" ? "missing" : "found",
  }).diagnostics;
  assert.equal(checked.length, 1);
  assert.equal(checked[0]?.rule, DIAGNOSTIC_RULES.missingImport);
  assert.equal(checked[0]?.severity, "warning");
  assert.equal(checked[0]?.range.start.line, 3);

  assert.doesNotThrow(() =>
    analyze(source, {
      fileType: "ufm",
      resolveImport: () => {
        throw new Error("resolver unavailable");
      },
    }),
  );
});

void test("legacy syntax is accepted, optional, and does not infer unknown parameters", () => {
  const source = `${readText("test/analyzer/legacy.ufm")}
Implicit-Parameter {
init:
  z = @notDeclared
loop:
  z = z
bailout:
  true
}
`;
  const result = analyze(source, { fileType: "ufm" });
  assert.deepEqual(
    result.diagnostics.map(({ rule }) => rule),
    [DIAGNOSTIC_RULES.legacySyntax],
  );
  assert.deepEqual(
    analyze(source, {
      fileType: "ufm",
      disabledRules: [DIAGNOSTIC_RULES.legacySyntax],
    }).diagnostics,
    [],
  );
});

void test("every stable rule is documented and analyzer code is VS Code independent", () => {
  assert.deepEqual(
    new Set(DIAGNOSTIC_RULE_DESCRIPTIONS.map(({ rule }) => rule)),
    new Set(Object.values(DIAGNOSTIC_RULES)),
  );
  const analyzerSources = [
    "src/analyzer/diagnostics.ts",
    "src/analyzer/index.ts",
    "src/analyzer/lexer.ts",
    "src/analyzer/parser.ts",
    "src/analyzer/source.ts",
    "src/analyzer/types.ts",
  ];
  for (const analyzerSource of analyzerSources) {
    assert.doesNotMatch(readText(analyzerSource), /from\s+["']vscode["']/u);
  }
});

void test("malformed input never throws across representative broken fragments", () => {
  const fragments = [
    "",
    "}",
    'Entry {\ninit:\n  value = "',
    "Entry {\ndefault:\n  param x\n}",
    "$endif\nEntry {\ntransform:\n}\n",
  ];
  for (const source of fragments) {
    assert.doesNotThrow(() => analyze(source, { fileType: "ufm" }));
    assert.doesNotThrow(() => parse(source, lex(source).tokens));
    assert.deepEqual(rules(source, "ufm"), rules(source, "ufm"));
  }
});
