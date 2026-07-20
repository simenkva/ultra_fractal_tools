import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as vscode from "vscode";

import { UltraFractalDiagnosticsController } from "../../editor/diagnostics";
import { getDiagnosticsController } from "../../extension";

const languageId = "ultra-fractal";

async function showUntitled(
  content: string,
): Promise<{ document: vscode.TextDocument; editor: vscode.TextEditor }> {
  const document = await vscode.workspace.openTextDocument({
    language: languageId,
    content,
  });
  const editor = await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
  await waitFor(
    () => vscode.window.activeTextEditor?.document === document,
    "the requested untitled document did not become active",
  );
  return { document, editor };
}

const lineIndent = (line: string): number => /^\s*/u.exec(line)?.[0].length ?? 0;

const waitFor = async (
  predicate: () => boolean,
  message: string,
  timeoutMilliseconds = 5_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(message);
};

const replaceDocument = async (
  document: vscode.TextDocument,
  text: string,
): Promise<void> => {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(
      new vscode.Position(0, 0),
      document.positionAt(document.getText().length),
    ),
    text,
  );
  assert.equal(await vscode.workspace.applyEdit(edit), true);
};

const diagnosticCode = (diagnostic: vscode.Diagnostic): string =>
  typeof diagnostic.code === "object"
    ? String(diagnostic.code.value)
    : String(diagnostic.code);

const diagnosticsFor = (uri: vscode.Uri): readonly vscode.Diagnostic[] =>
  vscode.languages.getDiagnostics(uri);

const closeDocumentTab = async (document: vscode.TextDocument): Promise<void> => {
  const tab = vscode.window.tabGroups.all
    .flatMap(({ tabs }) => tabs)
    .find(
      ({ input }) =>
        input instanceof vscode.TabInputText &&
        input.uri.toString() === document.uri.toString(),
  );
  assert.ok(tab, `no editor tab found for ${document.uri.toString()}`);
  assert.equal(await vscode.window.tabGroups.close(tab), true);
};

export async function run(): Promise<void> {
  const projectRoot = path.resolve(__dirname, "../../..");

  const extension = vscode.extensions.getExtension(
    "ultra-fractal-tools.ultra-fractal-language",
  );
  assert.ok(extension, "development extension must be installed");

  for (const extension of ["ufm", "ucl", "uxf", "ulb"]) {
    const file = vscode.Uri.file(
      path.join(projectRoot, `test/fixtures/minimal.${extension}`),
    );
    const document = await vscode.workspace.openTextDocument(file);
    assert.equal(document.languageId, "ultra-fractal");
    console.log(`PASS: .${extension} opens as ultra-fractal`);
  }
  assert.equal(extension.isActive, true);
  console.log("PASS: opening the language activates the M2 providers");

  for (const name of ["unsupported.upr", "unsupported.txt"]) {
    const file = vscode.Uri.file(path.join(projectRoot, "test/fixtures", name));
    const document = await vscode.workspace.openTextDocument(file);
    assert.notEqual(document.languageId, "ultra-fractal");
    console.log(`PASS: ${name} is not claimed`);
  }

  const structureFile = vscode.Uri.file(
    path.join(projectRoot, "test/grammar/syntax-cases.ufm"),
  );
  const structureDocument = await vscode.workspace.openTextDocument(
    structureFile,
  );
  const originalText = structureDocument.getText();
  const originalVersion = structureDocument.version;

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    structureFile,
  );
  assert.ok(symbols);
  assert.deepEqual(
    symbols.map(({ name }) => name),
    ["My-Formula", "Legacy-Formula"],
  );
  assert.deepEqual(
    symbols[0]?.children.map(({ name }) => name),
    ["global", "init", "loop", "bailout", "default"],
  );
  assert.deepEqual(
    symbols[0]?.children.at(-1)?.children.map(({ name }) => name),
    ["transform"],
  );
  console.log("PASS: Outline provides ordered entries, sections, and functions");

  const foldingRanges =
    await vscode.commands.executeCommand<vscode.FoldingRange[]>(
      "vscode.executeFoldingRangeProvider",
      structureFile,
    );
  assert.ok(foldingRanges);
  const folds = foldingRanges.map(({ start, end }) => [start, end]);
  for (const expected of [
    [0, 2],
    [4, 33],
    [6, 8],
    [22, 32],
    [26, 29],
    [30, 32],
  ]) {
    assert.ok(
      folds.some(
        ([start, end]) => start === expected[0] && end === expected[1],
      ),
      `missing folding range ${String(expected)}`,
    );
  }
  assert.equal(structureDocument.getText(), originalText);
  assert.equal(structureDocument.version, originalVersion);
  assert.equal(structureDocument.isDirty, false);
  console.log("PASS: folding is structural and legacy source remains untouched");

  const wordDocument = await vscode.workspace.openTextDocument({
    language: languageId,
    content: "z = @seed + #pixel",
  });
  const parameterWord = wordDocument.getWordRangeAtPosition(
    new vscode.Position(0, 6),
  );
  const predefinedWord = wordDocument.getWordRangeAtPosition(
    new vscode.Position(0, 14),
  );
  assert.ok(parameterWord);
  assert.ok(predefinedWord);
  assert.equal(wordDocument.getText(parameterWord), "@seed");
  assert.equal(wordDocument.getText(predefinedWord), "#pixel");
  console.log("PASS: word selection includes @ and # sigils");

  const singleComment = await showUntitled("alpha");
  singleComment.editor.selection = new vscode.Selection(0, 0, 0, 5);
  await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
  await vscode.commands.executeCommand("editor.action.commentLine");
  await waitFor(
    () => /^\s*;/u.test(singleComment.document.lineAt(0).text),
    "single-line comment toggle did not update the document",
  );
  assert.match(singleComment.document.lineAt(0).text, /^\s*;/u);
  await vscode.commands.executeCommand("editor.action.commentLine");
  await waitFor(
    () => singleComment.document.getText() === "alpha",
    "single-line uncomment did not update the document",
  );
  assert.equal(singleComment.document.getText(), "alpha");

  const multipleComments = await showUntitled("alpha\n  beta");
  multipleComments.editor.selection = new vscode.Selection(0, 0, 1, 6);
  await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
  await vscode.commands.executeCommand("editor.action.commentLine");
  await waitFor(
    () =>
      /^\s*;/u.test(multipleComments.document.lineAt(0).text) &&
      /^\s*;/u.test(multipleComments.document.lineAt(1).text),
    "multi-line comment toggle did not update the document",
  );
  assert.match(multipleComments.document.lineAt(0).text, /^\s*;/u);
  assert.match(multipleComments.document.lineAt(1).text, /^\s*;/u);
  await vscode.commands.executeCommand("editor.action.commentLine");
  await waitFor(
    () => multipleComments.document.getText() === "alpha\n  beta",
    "multi-line uncomment did not update the document",
  );
  assert.equal(multipleComments.document.getText(), "alpha\n  beta");
  console.log("PASS: single- and multi-line semicolon comment toggling works");

  const autoClose = await showUntitled("");
  await vscode.commands.executeCommand("type", { text: "(" });
  assert.equal(autoClose.document.getText(), "()");

  const surround = await showUntitled("value");
  surround.editor.selection = new vscode.Selection(0, 0, 0, 5);
  await vscode.commands.executeCommand("type", { text: '"' });
  assert.equal(surround.document.getText(), '"value"');
  console.log("PASS: brackets auto-close and strings surround selections");

  const openerIndent = await showUntitled("Example {");
  openerIndent.editor.selection = new vscode.Selection(0, 9, 0, 9);
  await vscode.commands.executeCommand("type", { text: "\n" });
  const entryContentIndent = lineIndent(openerIndent.document.lineAt(1).text);
  assert.ok(entryContentIndent > 0);

  const sectionIndent = await showUntitled("Example {\n    init");
  sectionIndent.editor.selection = new vscode.Selection(1, 8, 1, 8);
  await vscode.commands.executeCommand("type", { text: ":" });
  assert.equal(sectionIndent.document.lineAt(1).text, "init:");
  await vscode.commands.executeCommand("type", { text: "\n" });
  assert.ok(lineIndent(sectionIndent.document.lineAt(2).text) > 0);

  const keywordIndent = await showUntitled(
    "Example {\ninit:\n    if true\n        z = 0\n        endi",
  );
  keywordIndent.editor.selection = new vscode.Selection(4, 12, 4, 12);
  await vscode.commands.executeCommand("type", { text: "f" });
  assert.ok(
    lineIndent(keywordIndent.document.lineAt(4).text) <
      lineIndent(keywordIndent.document.lineAt(3).text),
  );
  await vscode.commands.executeCommand("type", { text: "\n" });
  assert.equal(
    lineIndent(keywordIndent.document.lineAt(5).text),
    lineIndent(keywordIndent.document.lineAt(4).text),
  );

  const braceIndent = await showUntitled(
    "Example {\ninit:\n    z = 0\n    ",
  );
  braceIndent.editor.selection = new vscode.Selection(3, 4, 3, 4);
  await vscode.commands.executeCommand("type", { text: "}" });
  assert.equal(braceIndent.document.lineAt(3).text, "}");
  await vscode.commands.executeCommand("type", { text: "\n" });
  assert.equal(lineIndent(braceIndent.document.lineAt(4).text), 0);
  console.log("PASS: entry/block content indents and closers outdent on type");

  const snippetDocument = await showUntitled("");
  await vscode.commands.executeCommand("editor.action.insertSnippet", {
    langId: languageId,
    name: "Fractal formula",
  });
  assert.match(snippetDocument.document.getText(), /bailout:[\s\S]*default:/u);
  assert.ok(snippetDocument.editor.selections.length >= 1);
  console.log("PASS: contributed formula snippet inserts a tab-stopped skeleton");

  const diagnosticsController = getDiagnosticsController();
  assert.ok(diagnosticsController, "M4 diagnostics controller must be active");

  const configurationKeys = [
    "lint.enabled",
    "lint.debounceMilliseconds",
    "lint.maxDiagnostics",
    "lint.severityOverrides",
    "formulaSearchPaths",
  ] as const;
  const originalConfiguration = new Map(
    configurationKeys.map((key) => [
      key,
      vscode.workspace
        .getConfiguration("ultraFractal")
        .inspect(key)?.globalValue,
    ]),
  );
  const updateConfiguration = async (
    key: (typeof configurationKeys)[number],
    value: unknown,
  ): Promise<void> => {
    await vscode.workspace
      .getConfiguration("ultraFractal")
      .update(key, value, vscode.ConfigurationTarget.Global);
  };
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "uf-vscode-"));
  const validSource = `Mandelbrot {
init:
  z = 0
loop:
  z = sqr(z) + #pixel
bailout:
  |z| < 4
default:
  title = "Mandelbrot"
}
`;
  const invalidSource = `Broken {
default:
  title = "unterminated
}
`;

  try {
    await updateConfiguration("lint.enabled", true);
    await updateConfiguration("lint.debounceMilliseconds", 100);
    await updateConfiguration("lint.maxDiagnostics", 100);
    await updateConfiguration("lint.severityOverrides", {});
    await updateConfiguration("formulaSearchPaths", []);

    const openFile = vscode.Uri.file(path.join(temporaryRoot, "open.ufm"));
    await writeFile(openFile.fsPath, invalidSource, "utf8");
    const openDocument = await vscode.workspace.openTextDocument(openFile);
    await vscode.window.showTextDocument(openDocument);
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await waitFor(
      () => vscode.window.activeTextEditor?.document === openDocument,
      "the open-lifecycle test document did not become active",
    );
    await waitFor(
      () => diagnosticsFor(openFile).some((item) => diagnosticCode(item) === "UF1001"),
      "opening an invalid formula did not publish UF1001",
    );
    const manualCount = await vscode.commands.executeCommand<number>(
      "ultraFractal.validateCurrentFile",
    );
    assert.equal(manualCount, 1);
    await closeDocumentTab(openDocument);
    diagnosticsController.handleDocumentClosed(openDocument);
    await waitFor(
      () => diagnosticsFor(openFile).length === 0,
      "closing a formula did not clear its diagnostics",
    );
    console.log("PASS: open, manual validation, and close diagnostics lifecycle works");

    await updateConfiguration("lint.debounceMilliseconds", 1_000);
    const saveFile = vscode.Uri.file(path.join(temporaryRoot, "save.ufm"));
    await writeFile(saveFile.fsPath, validSource, "utf8");
    const saveDocument = await vscode.workspace.openTextDocument(saveFile);
    await vscode.window.showTextDocument(saveDocument);
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await waitFor(
      () => vscode.window.activeTextEditor?.document === saveDocument,
      "the save-lifecycle test document did not become active",
    );
    await replaceDocument(saveDocument, invalidSource);
    assert.equal(await saveDocument.save(), true);
    await waitFor(
      () => diagnosticsFor(saveFile).some((item) => diagnosticCode(item) === "UF1001"),
      "saving an invalid formula did not validate immediately",
    );
    await replaceDocument(saveDocument, validSource);
    assert.equal(await saveDocument.save(), true);
    await waitFor(
      () => diagnosticsFor(saveFile).length === 0,
      "saving a corrected formula did not clear diagnostics",
    );
    await closeDocumentTab(saveDocument);
    console.log("PASS: save bypasses the debounce and corrections clear diagnostics");

    await updateConfiguration("lint.debounceMilliseconds", 100);
    const changeDocument = (await showUntitled(invalidSource)).document;
    await waitFor(
      () => diagnosticsFor(changeDocument.uri).length === 1,
      "an edited untitled formula did not receive diagnostics",
    );
    await replaceDocument(changeDocument, validSource);
    await waitFor(
      () => diagnosticsFor(changeDocument.uri).length === 0,
      "correcting an edited formula did not clear diagnostics",
    );
    console.log("PASS: debounced change diagnostics clear after correction");

    await updateConfiguration("lint.debounceMilliseconds", 400);
    await waitFor(
      () => !diagnosticsController.getValidationState(changeDocument.uri).pending,
      "configuration-triggered validation did not settle",
    );
    const runsBefore = diagnosticsController.getValidationState(
      changeDocument.uri,
    ).startedRuns;
    await replaceDocument(changeDocument, invalidSource);
    await replaceDocument(changeDocument, `${invalidSource}\n; newer edit\n`);
    await replaceDocument(changeDocument, validSource);
    await waitFor(() => {
      const state = diagnosticsController.getValidationState(changeDocument.uri);
      return !state.pending && state.publishedVersion === changeDocument.version;
    }, "rapid edits did not publish the latest document version");
    const runsAfter = diagnosticsController.getValidationState(
      changeDocument.uri,
    ).startedRuns;
    assert.ok(runsAfter - runsBefore <= 1);
    assert.equal(diagnosticsFor(changeDocument.uri).length, 0);
    console.log("PASS: rapid edits coalesce without publishing stale diagnostics");

    await replaceDocument(changeDocument, invalidSource);
    await diagnosticsController.validateNow(changeDocument, "lint toggle setup");
    assert.equal(diagnosticsFor(changeDocument.uri).length, 1);
    await updateConfiguration("lint.enabled", false);
    await waitFor(
      () => diagnosticsFor(changeDocument.uri).length === 0,
      "disabling lint did not clear diagnostics",
    );
    assert.equal(changeDocument.languageId, languageId);
    assert.equal(
      await vscode.commands.executeCommand<number>(
        "ultraFractal.validateCurrentFile",
      ),
      0,
    );
    await updateConfiguration("lint.enabled", true);
    await waitFor(
      () => diagnosticsFor(changeDocument.uri).length === 1,
      "re-enabling lint did not restore diagnostics",
    );
    console.log("PASS: lint can be disabled independently of language support");

    await updateConfiguration("lint.severityOverrides", { UF1001: "hint" });
    await waitFor(
      () => diagnosticsFor(changeDocument.uri)[0]?.severity === vscode.DiagnosticSeverity.Hint,
      "severity override was not applied",
    );
    await updateConfiguration("lint.severityOverrides", { UF1001: "off" });
    await waitFor(
      () => diagnosticsFor(changeDocument.uri).length === 0,
      "disabled diagnostic rule remained visible",
    );
    await updateConfiguration("lint.severityOverrides", {});

    const manyDiagnosticsSource = `Broken {
loop:
  float param Limit
  endparam
init:
  float param @limit
  endparam
  title = "unterminated
}
`;
    await updateConfiguration("lint.maxDiagnostics", 1);
    await replaceDocument(changeDocument, manyDiagnosticsSource);
    await waitFor(
      () => diagnosticsFor(changeDocument.uri).length === 1,
      "diagnostic maximum was not applied",
    );
    await updateConfiguration("lint.maxDiagnostics", 100);
    console.log("PASS: severity overrides, rule disabling, and limits apply live");

    const importDocument = (
      await showUntitled(`comment {
  import "documentation-only.ulb"
}
Imports {
global:
  import "minimal.ulb"
}
`)
    ).document;
    await updateConfiguration("formulaSearchPaths", [
      path.join(projectRoot, "test/analyzer"),
    ]);
    await waitFor(
      () => diagnosticsFor(importDocument.uri).some((item) => diagnosticCode(item) === "UF2003"),
      "a missing import did not produce UF2003",
    );
    const importedFile = path.join(projectRoot, "test/fixtures/minimal.ulb");
    await updateConfiguration("formulaSearchPaths", [
      path.join(projectRoot, "test/fixtures"),
    ]);
    await waitFor(
      () => !diagnosticsFor(importDocument.uri).some((item) => diagnosticCode(item) === "UF2003"),
      "updating formula search paths did not resolve the import",
    );
    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeLinkProvider",
      importDocument.uri,
    );
    assert.equal(links.length, 1);
    assert.equal(links[0]?.target?.fsPath, importedFile);
    const definitions = await vscode.commands.executeCommand<
      (vscode.Location | vscode.LocationLink)[]
    >(
      "vscode.executeDefinitionProvider",
      importDocument.uri,
      new vscode.Position(5, 12),
    );
    assert.equal(definitions.length, 1);
    const definition = definitions[0];
    assert.ok(definition instanceof vscode.Location);
    assert.equal(definition.uri.fsPath, importedFile);
    console.log("PASS: search-path changes update diagnostics and import navigation");

    await waitFor(
      () => !diagnosticsController.getValidationState(importDocument.uri).pending,
      "import validation did not settle before the cache check",
    );
    const cacheStateBefore = diagnosticsController.getValidationState(
      importDocument.uri,
    );
    await diagnosticsController.validateNow(importDocument, "M5 cache check");
    const cacheStateAfter = diagnosticsController.getValidationState(
      importDocument.uri,
    );
    assert.equal(cacheStateAfter.analysisRuns, cacheStateBefore.analysisRuns);
    assert.equal(cacheStateAfter.cacheHits, cacheStateBefore.cacheHits + 1);
    console.log("PASS: unchanged revalidation reuses cached analyzer results");

    await updateConfiguration("lint.enabled", false);
    const largeSource = `Large-Lifecycle-Test {
init:
${"  z = z + #pixel\n".repeat(120_000)}}
`;
    const largeDocument = (await showUntitled(largeSource)).document;
    assert.ok(largeDocument.getText().length > 2_000_000);
    const navigationStarted = Date.now();
    assert.deepEqual(
      await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        "vscode.executeLinkProvider",
        largeDocument.uri,
      ),
      [],
    );
    assert.ok(
      Date.now() - navigationStarted < 5_000,
      "large-file import navigation exceeded five seconds",
    );
    await updateConfiguration("lint.enabled", true);
    await waitFor(
      () => {
        const state = diagnosticsController.getValidationState(
          largeDocument.uri,
        );
        return state.analysisRuns > 0 && state.pending;
      },
      "large-file worker did not start",
      15_000,
    );
    const discardedBefore = diagnosticsController.getValidationState(
      largeDocument.uri,
    ).discardedRuns;
    await replaceDocument(largeDocument, validSource);
    await waitFor(
      () => {
        const state = diagnosticsController.getValidationState(
          largeDocument.uri,
        );
        return (
          !state.pending &&
          state.publishedVersion === largeDocument.version &&
          state.discardedRuns > discardedBefore
        );
      },
      "obsolete large-file analysis was not cancelled and replaced",
      15_000,
    );
    assert.equal(diagnosticsFor(largeDocument.uri).length, 0);
    assert.equal(diagnosticsController.hasDocumentState(largeDocument.uri), true);
    await closeDocumentTab(largeDocument);
    diagnosticsController.handleDocumentClosed(largeDocument);
    assert.equal(diagnosticsController.hasDocumentState(largeDocument.uri), false);
    assert.equal(diagnosticsFor(largeDocument.uri).length, 0);
    console.log(
      "PASS: large-file work is cancellable and close releases document state",
    );

    const failureDiagnostics = new Map<string, readonly vscode.Diagnostic[]>();
    const failureCollection = {
      delete: (uri: vscode.Uri): void => {
        failureDiagnostics.delete(uri.toString());
      },
      set: (uri: vscode.Uri, diagnostics: readonly vscode.Diagnostic[]): void => {
        failureDiagnostics.set(uri.toString(), diagnostics);
      },
    } as vscode.DiagnosticCollection;
    const failureOutputLines: string[] = [];
    const failureOutput = {
      appendLine: (line: string): void => {
        failureOutputLines.push(line);
      },
    } as vscode.OutputChannel;
    const failureController = new UltraFractalDiagnosticsController(
      failureCollection,
      failureOutput,
      {
        analyzeSource: () => {
          throw new Error("expected test analyzer failure");
        },
      },
    );
    try {
      await assert.doesNotReject(async () => {
        assert.equal(
          await failureController.validateNow(importDocument, "failure test"),
          undefined,
        );
      });
      assert.equal(failureDiagnostics.get(importDocument.uri.toString())?.length ?? 0, 0);
      assert.ok(
        failureOutputLines.some((line) => line.includes("expected test analyzer failure")),
      );
    } finally {
      failureController.dispose();
    }
    console.log("PASS: analyzer failures are logged and contained");
  } finally {
    for (const key of configurationKeys) {
      await updateConfiguration(key, originalConfiguration.get(key));
    }
    await waitFor(
      () =>
        vscode.workspace.textDocuments
          .filter((document) => document.languageId === languageId)
          .every(
            ({ uri }) =>
              !diagnosticsController.getValidationState(uri).pending,
          ),
      "restored-configuration validation did not settle",
    );
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
