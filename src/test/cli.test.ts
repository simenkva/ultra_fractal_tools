import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { parseCliArguments } from "../cli/analyze";

const projectRoot = path.resolve(__dirname, "../..");
const cliPath = path.join(projectRoot, "out/cli/analyze.js");

interface CliExecution {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

const runCli = (
  args: readonly string[],
  input?: string | Buffer,
): CliExecution => {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

void test("CLI arguments require explicit stdin type and conservative imports", () => {
  assert.throws(
    () => parseCliArguments(["--stdin"]),
    /requires --file-type/iu,
  );
  assert.throws(
    () =>
      parseCliArguments([
        "--stdin",
        "--file-type",
        "ufm",
        "--imports",
        "exhaustive",
      ]),
    /requires at least one --search-path/iu,
  );
  const options = parseCliArguments(["test/fixtures/minimal.ufm"]);
  assert.equal(options.importMode, "unchecked");
  assert.equal(options.encoding, "utf8");
  assert.equal(options.timeoutMilliseconds, 120_000);
});

void test("CLI text output reports stable IDs with one-based locations", () => {
  const result = runCli(["test/analyzer/incomplete.ufm"]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /incomplete\.ufm:\d+:\d+: error UF1001:/u);
  assert.match(result.stdout, /compilation and rendering not tested/iu);
  assert.equal(result.stderr, "");
});

void test("CLI JSON output records structural-only validation", () => {
  const result = runCli([
    "--format",
    "json",
    "test/fixtures/minimal.ucl",
    "test/fixtures/minimal.uxf",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as {
    readonly schemaVersion: number;
    readonly target: string;
    readonly validationLevel: string;
    readonly compiled: boolean;
    readonly rendered: boolean;
    readonly files: readonly {
      readonly path: string;
      readonly definitions: readonly {
        readonly name: string;
        readonly kind: string;
      }[];
    }[];
    readonly summary: { readonly files: number };
  };
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.target, "UF6");
  assert.equal(report.validationLevel, "structural");
  assert.equal(report.compiled, false);
  assert.equal(report.rendered, false);
  assert.equal(report.summary.files, 2);
  assert.ok(report.files.every(({ path: filePath }) => !path.isAbsolute(filePath)));
  assert.ok(
    report.files.every(
      ({ definitions }) =>
        definitions.length === 1 &&
        definitions[0]?.kind === "entry" &&
        definitions[0].name.length > 0,
    ),
  );
});

void test("CLI stdin and Latin-1 modes are explicit", () => {
  const stdinResult = runCli(
    ["--stdin", "--file-type", "ufm", "--format", "json"],
    "Stdin-Test {\ninit:\n  z = #pixel\n}\n",
  );
  assert.equal(stdinResult.status, 0, stdinResult.stderr);
  assert.equal(
    (JSON.parse(stdinResult.stdout) as { files: { path: string }[] }).files[0]
      ?.path,
    "<stdin>",
  );

  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "uf-cli-"));
  try {
    const filePath = path.join(temporaryRoot, "latin1.ufm");
    writeFileSync(
      filePath,
      Buffer.concat([
        Buffer.from("comment {\nCopyright ", "ascii"),
        Buffer.from([0xe9]),
        Buffer.from("\n}\nLatin1-Test {\ninit:\n  z = #pixel\n}\n", "ascii"),
      ]),
    );
    const invalidUtf8 = runCli([filePath]);
    assert.equal(invalidUtf8.status, 2);
    assert.match(invalidUtf8.stderr, /not valid UTF-8/iu);

    const latin1 = runCli(["--encoding", "latin1", filePath]);
    assert.equal(latin1.status, 0, latin1.stderr);
    assert.match(latin1.stdout, /structurally clean/iu);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

void test("CLI import warnings require exhaustive mode", () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "uf-cli-import-"));
  try {
    const filePath = path.join(temporaryRoot, "imports.ufm");
    writeFileSync(
      filePath,
      'Import-Test {\nglobal:\n  import "missing.ulb"\ninit:\n  z = #pixel\n}\n',
    );
    const unchecked = runCli(["--format", "json", filePath]);
    assert.equal(unchecked.status, 0, unchecked.stderr);
    assert.ok(!unchecked.stdout.includes("UF2003"));

    const exhaustive = runCli([
      "--format",
      "json",
      "--imports",
      "exhaustive",
      filePath,
    ]);
    assert.equal(exhaustive.status, 0, exhaustive.stderr);
    assert.ok(exhaustive.stdout.includes("UF2003"));

    const disabled = runCli([
      "--format",
      "json",
      "--imports",
      "exhaustive",
      "--disable",
      "UF2003",
      filePath,
    ]);
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.ok(!disabled.stdout.includes("UF2003"));
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

void test("CLI rejects unsupported extensions and exposes help", () => {
  const unsupported = runCli(["test/fixtures/unsupported.txt"]);
  assert.equal(unsupported.status, 2);
  assert.match(unsupported.stderr, /unsupported formula file type/iu);

  const help = runCli(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /structural analysis only/iu);
  assert.equal(help.stderr, "");

  assert.doesNotThrow(() => readFileSync(cliPath));
});

void test("CLI bounds worker analysis with a per-file timeout", () => {
  const source = `Timeout-Test {\ninit:\n${"  z = z + #pixel\n".repeat(200_000)}}\n`;
  const result = runCli(
    [
      "--stdin",
      "--file-type",
      "ufm",
      "--timeout-ms",
      "1",
    ],
    source,
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /timed out after 1 ms/iu);
});
