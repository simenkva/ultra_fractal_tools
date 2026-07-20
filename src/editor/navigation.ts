import * as vscode from "vscode";

import {
  importRootsForDocument,
  isUltraFractalDocument,
  validationSettingsFor,
} from "./diagnostics";
import { resolveImportPath } from "./imports";

interface ResolvedImportDeclaration {
  readonly range: vscode.Range;
  readonly target: vscode.Uri;
}

const documentationStartPattern = /^\s*comment\s*\{/iu;
const documentationEndPattern = /^\s*\}\s*(?:;.*)?$/u;
const documentationSingleLinePattern = /^\s*comment\s*\{\s*\}\s*(?:;.*)?$/iu;
const importPattern = /^\s*import\s+"([^"\r\n]+)"/iu;

interface ImportReference {
  readonly importPath: string;
  readonly range: vscode.Range;
}

const importReferences = (
  document: vscode.TextDocument,
  token: vscode.CancellationToken,
): readonly ImportReference[] => {
  const references: ImportReference[] = [];
  let inDocumentation = false;
  for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
    if (token.isCancellationRequested) {
      break;
    }
    const text = document.lineAt(lineNumber).text;
    if (inDocumentation) {
      if (documentationEndPattern.test(text)) {
        inDocumentation = false;
      }
      continue;
    }
    if (documentationStartPattern.test(text)) {
      inDocumentation = !documentationSingleLinePattern.test(text);
      continue;
    }
    if (/^\s*;/u.test(text)) {
      continue;
    }
    const match = importPattern.exec(text);
    const importPath = match?.[1];
    if (match === null || importPath === undefined) {
      continue;
    }
    const quote = text.indexOf('"', match.index);
    const start = quote + 1;
    references.push({
      importPath,
      range: new vscode.Range(
        new vscode.Position(lineNumber, start),
        new vscode.Position(lineNumber, start + importPath.length),
      ),
    });
  }
  return references;
};

const resolvedImports = (
  document: vscode.TextDocument,
  token: vscode.CancellationToken,
): readonly ResolvedImportDeclaration[] => {
  const settings = validationSettingsFor(document);
  const roots = importRootsForDocument(document, settings);
  const result: ResolvedImportDeclaration[] = [];

  for (const { importPath, range } of importReferences(document, token)) {
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
      return resolvedImports(document, token).map(({ range, target }) => {
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
      const resolved = resolvedImports(document, token).find(({ range }) =>
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
