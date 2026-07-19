import path from "node:path";

import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../..");
  const extensionTestsPath = path.resolve(__dirname, "suite/index");

  // When invoked from VS Code's integrated extension host, this variable is
  // inherited by child processes. A desktop Electron process must not run in
  // Node mode or it will reject VS Code's launch arguments.
  delete process.env.ELECTRON_RUN_AS_NODE;

  await runTests({ extensionDevelopmentPath, extensionTestsPath });
}

void main().catch((error: unknown) => {
  console.error("Failed to run VS Code integration tests", error);
  process.exitCode = 1;
});
