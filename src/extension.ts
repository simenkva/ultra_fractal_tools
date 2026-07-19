import * as vscode from "vscode";

import {
  UltraFractalDocumentSymbolProvider,
  UltraFractalFoldingRangeProvider,
  UltraFractalOnTypeFormattingEditProvider,
} from "./editor/providers";
import { UltraFractalDiagnosticsController } from "./editor/diagnostics";
import {
  UltraFractalDefinitionProvider,
  UltraFractalDocumentLinkProvider,
} from "./editor/navigation";

const languageSelector: vscode.DocumentSelector = [
  { language: "ultra-fractal", scheme: "file" },
  { language: "ultra-fractal", scheme: "untitled" },
];

let diagnosticsController: UltraFractalDiagnosticsController | undefined;

export const getDiagnosticsController =
  (): UltraFractalDiagnosticsController | undefined => diagnosticsController;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Ultra Fractal");
  const diagnostics = vscode.languages.createDiagnosticCollection(
    "ultra-fractal",
  );
  diagnosticsController = new UltraFractalDiagnosticsController(
    diagnostics,
    output,
  );
  diagnosticsController.start();

  context.subscriptions.push(
    output,
    diagnostics,
    diagnosticsController,
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
    vscode.languages.registerDocumentLinkProvider(
      languageSelector,
      new UltraFractalDocumentLinkProvider(output),
    ),
    vscode.languages.registerDefinitionProvider(
      languageSelector,
      new UltraFractalDefinitionProvider(output),
    ),
    vscode.commands.registerCommand(
      "ultraFractal.validateCurrentFile",
      async (): Promise<number | undefined> => {
        const document = vscode.window.activeTextEditor?.document;
        if (document?.languageId !== "ultra-fractal") {
          await vscode.window.showInformationMessage(
            "Open an Ultra Fractal formula file to validate it.",
          );
          return undefined;
        }
        const count = await diagnosticsController?.validateNow(
          document,
          "manual command",
        );
        if (count === undefined) {
          await vscode.window.showErrorMessage(
            "Ultra Fractal validation failed. See the Ultra Fractal output channel.",
          );
        }
        return count;
      },
    ),
  );
}

export function deactivate(): void {
  diagnosticsController = undefined;
}
