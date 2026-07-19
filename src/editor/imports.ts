import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import type { ImportResolution } from "../analyzer";

export interface ImportSearchContext {
  readonly documentPath?: string;
  readonly workspaceRoots: readonly string[];
  readonly configuredPaths: readonly string[];
}

export interface ResolvedImport {
  readonly status: ImportResolution;
  readonly filePath?: string;
}

const uniqueResolvedPaths = (values: readonly string[]): readonly string[] => {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const resolved = path.resolve(value);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      result.push(resolved);
    }
  }
  return result;
};

export function importSearchRoots(
  context: ImportSearchContext,
): readonly string[] {
  const documentDirectory =
    context.documentPath === undefined
      ? undefined
      : path.dirname(context.documentPath);
  const roots: string[] = [];
  if (documentDirectory !== undefined) {
    roots.push(documentDirectory);
  }
  roots.push(...context.workspaceRoots);

  for (const configuredPath of context.configuredPaths) {
    if (path.isAbsolute(configuredPath)) {
      roots.push(configuredPath);
    } else if (context.workspaceRoots.length > 0) {
      roots.push(
        ...context.workspaceRoots.map((root) => path.resolve(root, configuredPath)),
      );
    } else if (documentDirectory !== undefined) {
      roots.push(path.resolve(documentDirectory, configuredPath));
    }
  }
  return uniqueResolvedPaths(roots);
}

const isMissingPathError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "ENOENT" || error.code === "ENOTDIR");

const exactFile = (
  candidate: string,
): { readonly filePath?: string; readonly unchecked: boolean } => {
  try {
    return statSync(candidate).isFile()
      ? { filePath: candidate, unchecked: false }
      : { unchecked: false };
  } catch (error: unknown) {
    return isMissingPathError(error)
      ? { unchecked: false }
      : { unchecked: true };
  }
};

const caseInsensitiveFile = (
  candidate: string,
): { readonly filePath?: string; readonly unchecked: boolean } => {
  const directory = path.dirname(candidate);
  const requestedName = path.basename(candidate).toLocaleLowerCase("en-US");
  try {
    const matchingEntry = readdirSync(directory, { withFileTypes: true }).find(
      (entry) =>
        entry.name.toLocaleLowerCase("en-US") === requestedName &&
        (entry.isFile() || entry.isSymbolicLink()),
    );
    return matchingEntry === undefined
      ? { unchecked: false }
      : { filePath: path.join(directory, matchingEntry.name), unchecked: false };
  } catch (error: unknown) {
    return isMissingPathError(error)
      ? { unchecked: false }
      : { unchecked: true };
  }
};

export function resolveImportPath(
  importPath: string,
  roots: readonly string[],
): ResolvedImport {
  if (roots.length === 0 || importPath.trim().length === 0) {
    return { status: "unchecked" };
  }

  let unchecked = false;
  for (const root of roots) {
    const candidate = path.resolve(root, importPath);
    const exact = exactFile(candidate);
    if (exact.filePath !== undefined) {
      return { status: "found", filePath: exact.filePath };
    }
    unchecked ||= exact.unchecked;

    const insensitive = caseInsensitiveFile(candidate);
    if (insensitive.filePath !== undefined) {
      return { status: "found", filePath: insensitive.filePath };
    }
    unchecked ||= insensitive.unchecked;
  }
  return { status: unchecked ? "unchecked" : "missing" };
}
