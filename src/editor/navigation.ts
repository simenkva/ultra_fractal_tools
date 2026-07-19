import * as vscode from "vscode";

import { analyze, type DeclarationNode } from "../analyzer";
import {
  formulaFileType,
  importRootsForDocument,
  isUltraFractalDocument,
  validationSettingsFor,
} from "./diagnostics";
import { resolveImportPath } from "./imports";

interface ResolvedImportDeclaration {
  readonly range: vscode.Range;
  readonly target: vscode.Uri;
}

const importDeclarations = (
  declarations: readonly DeclarationNode[],
): readonly DeclarationNode[] =>
  declarations.filter(
    (declaration) =>
      declaration.kind === "import" &&
      declaration.importPath !== undefined &&
      declaration.nameRange !== undefined,
  );

const navigationRange = (
  document: vscode.TextDocument,
  declaration: DeclarationNode,
): vscode.Range | undefined => {
  const sourceRange = declaration.nameRange;
  if (sourceRange === undefined) {
    return undefined;
  }
  let startOffset = sourceRange.start.offset;
  let endOffset = sourceRange.end.offset;
  const text = document.getText();
  if (text[startOffset] === '"') {
    startOffset += 1;
  }
  if (text[endOffset - 1] === '"') {
    endOffset -= 1;
  }
  return new vscode.Range(
    document.positionAt(startOffset),
    document.positionAt(Math.max(startOffset, endOffset)),
  );
};

const resolvedImports = (
  document: vscode.TextDocument,
): readonly ResolvedImportDeclaration[] => {
  const settings = validationSettingsFor(document);
  const roots = importRootsForDocument(document, settings);
  const program = analyze(document.getText(), {
    fileType: formulaFileType(document),
  }).program;
  const declarations = program.definitions.flatMap((definition) => [
    ...definition.declarations,
    ...definition.sections.flatMap((section) => section.declarations),
  ]);
  const result: ResolvedImportDeclaration[] = [];

  for (const declaration of importDeclarations(declarations)) {
    const importPath = declaration.importPath;
    const range = navigationRange(document, declaration);
    if (importPath === undefined || range === undefined) {
      continue;
    }
    const resolved = resolveImportPath(importPath, roots);
    if (resolved.status === "found" && resolved.filePath !== undefined) {
      result.push({ range, target: vscode.Uri.file(resolved.filePath) });
    }
  }
  return result;
};

const logNavigationFailure = (
  output: vscode.OutputChannel,
  document: vscode.TextDocument,
  error: unknown,
): void => {
  const detail =
    error instanceof Error ? error.stack ?? error.message : String(error);
  output.appendLine(
    `Import navigation failure for ${document.uri.toString()}: ${detail}`,
  );
};

export class UltraFractalDocumentLinkProvider
  implements vscode.DocumentLinkProvider
{
  public constructor(private readonly output: vscode.OutputChannel) {}

  public provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    if (!isUltraFractalDocument(document) || token.isCancellationRequested) {
      return [];
    }
    try {
      return resolvedImports(document).map(({ range, target }) => {
        const link = new vscode.DocumentLink(range, target);
        link.tooltip = "Open imported Ultra Fractal file";
        return link;
      });
    } catch (error: unknown) {
      logNavigationFailure(this.output, document, error);
      return [];
    }
  }
}

export class UltraFractalDefinitionProvider
  implements vscode.DefinitionProvider
{
  public constructor(private readonly output: vscode.OutputChannel) {}

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Definition> {
    if (!isUltraFractalDocument(document) || token.isCancellationRequested) {
      return undefined;
    }
    try {
      const resolved = resolvedImports(document).find(({ range }) =>
        range.contains(position),
      );
      return resolved === undefined
        ? undefined
        : new vscode.Location(resolved.target, new vscode.Position(0, 0));
    } catch (error: unknown) {
      logNavigationFailure(this.output, document, error);
      return undefined;
    }
  }
}
