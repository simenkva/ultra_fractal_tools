import * as vscode from "vscode";

import { indentationAdjustmentAfterNewline } from "./indentation";
import {
  scanStructure,
  type StructureItem,
  type StructureKind,
} from "./structure";

const symbolKinds: Readonly<Record<StructureKind, vscode.SymbolKind>> = {
  entry: vscode.SymbolKind.Function,
  class: vscode.SymbolKind.Class,
  section: vscode.SymbolKind.Namespace,
  function: vscode.SymbolKind.Method,
};

function toDocumentSymbol(
  document: vscode.TextDocument,
  item: StructureItem,
): vscode.DocumentSymbol {
  const endLine = Math.min(item.endLine, document.lineCount - 1);
  const range = new vscode.Range(
    item.startLine,
    0,
    endLine,
    document.lineAt(endLine).text.length,
  );
  const selectionRange = new vscode.Range(
    item.startLine,
    Math.max(0, item.selectionStart),
    item.startLine,
    Math.max(0, item.selectionStart) + item.selectionLength,
  );
  const symbol = new vscode.DocumentSymbol(
    item.name,
    item.kind,
    symbolKinds[item.kind],
    range,
    selectionRange,
  );
  symbol.children = item.children.map((child) =>
    toDocumentSymbol(document, child),
  );
  return symbol;
}

const leadingWhitespaceRange = (
  document: vscode.TextDocument,
  lineNumber: number,
): vscode.Range => {
  const line = document.lineAt(lineNumber);
  const length = /^\s*/u.exec(line.text)?.[0].length ?? 0;
  return new vscode.Range(lineNumber, 0, lineNumber, length);
};

export class UltraFractalOnTypeFormattingEditProvider
  implements vscode.OnTypeFormattingEditProvider
{
  provideOnTypeFormattingEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    character: string,
    options: vscode.FormattingOptions,
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    const tabSize =
      typeof options.tabSize === "number" ? options.tabSize : Number(options.tabSize);
    const indentUnit = options.insertSpaces ? " ".repeat(tabSize) : "\t";
    const lineToAdjust = character === "\n" ? position.line - 1 : position.line;
    if (lineToAdjust < 0) {
      return [];
    }
    const adjustment = indentationAdjustmentAfterNewline(
      document.getText(),
      lineToAdjust,
      indentUnit,
    );
    if (adjustment === undefined) {
      return [];
    }
    const edits = [
      vscode.TextEdit.replace(
        leadingWhitespaceRange(document, lineToAdjust),
        adjustment.previousLine,
      ),
    ];
    if (character === "\n" && position.line < document.lineCount) {
      edits.push(
        vscode.TextEdit.replace(
          leadingWhitespaceRange(document, position.line),
          adjustment.nextLine,
        ),
      );
    }
    return edits;
  }
}

export class UltraFractalDocumentSymbolProvider
  implements vscode.DocumentSymbolProvider
{
  provideDocumentSymbols(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    return scanStructure(document.getText()).symbols.map((item) =>
      toDocumentSymbol(document, item),
    );
  }
}

export class UltraFractalFoldingRangeProvider
  implements vscode.FoldingRangeProvider
{
  provideFoldingRanges(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    return scanStructure(document.getText()).foldingRegions.map(
      ({ startLine, endLine }) =>
        new vscode.FoldingRange(
          startLine,
          endLine,
          vscode.FoldingRangeKind.Region,
        ),
    );
  }
}
