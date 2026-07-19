import assert from "node:assert/strict";
import path from "node:path";

import * as vscode from "vscode";

const languageId = "ultra-fractal";

async function showUntitled(
  content: string,
): Promise<{ document: vscode.TextDocument; editor: vscode.TextEditor }> {
  const document = await vscode.workspace.openTextDocument({
    language: languageId,
    content,
  });
  const editor = await vscode.window.showTextDocument(document);
  return { document, editor };
}

const lineIndent = (line: string): number => /^\s*/u.exec(line)?.[0].length ?? 0;

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
  await vscode.commands.executeCommand("editor.action.commentLine");
  assert.match(singleComment.document.lineAt(0).text, /^\s*;/u);
  await vscode.commands.executeCommand("editor.action.commentLine");
  assert.equal(singleComment.document.getText(), "alpha");

  const multipleComments = await showUntitled("alpha\n  beta");
  multipleComments.editor.selection = new vscode.Selection(0, 0, 1, 6);
  await vscode.commands.executeCommand("editor.action.commentLine");
  assert.match(multipleComments.document.lineAt(0).text, /^\s*;/u);
  assert.match(multipleComments.document.lineAt(1).text, /^\s*;/u);
  await vscode.commands.executeCommand("editor.action.commentLine");
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
}
