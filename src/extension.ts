import * as vscode from "vscode";

import {
  UltraFractalDocumentSymbolProvider,
  UltraFractalFoldingRangeProvider,
  UltraFractalOnTypeFormattingEditProvider,
} from "./editor/providers";

const languageSelector: vscode.DocumentSelector = [
  { language: "ultra-fractal", scheme: "file" },
  { language: "ultra-fractal", scheme: "untitled" },
];

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      languageSelector,
      new UltraFractalDocumentSymbolProvider(),
    ),
    vscode.languages.registerFoldingRangeProvider(
      languageSelector,
      new UltraFractalFoldingRangeProvider(),
    ),
    vscode.languages.registerOnTypeFormattingEditProvider(
      languageSelector,
      new UltraFractalOnTypeFormattingEditProvider(),
      ":",
      "}",
      "f",
      "F",
      "e",
      "E",
      "l",
      "L",
      "c",
      "C",
      "m",
      "M",
      "g",
      "G",
    ),
  );
}

export function deactivate(): void {
  // Providers registered through the extension context are disposed by VS Code.
}
