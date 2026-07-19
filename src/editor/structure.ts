export type StructureKind = "entry" | "class" | "section" | "function";

export interface StructureItem {
  readonly name: string;
  readonly kind: StructureKind;
  readonly startLine: number;
  readonly endLine: number;
  readonly selectionStart: number;
  readonly selectionLength: number;
  readonly children: readonly StructureItem[];
}

export interface FoldingRegion {
  readonly startLine: number;
  readonly endLine: number;
}

export interface StructureScan {
  readonly symbols: readonly StructureItem[];
  readonly foldingRegions: readonly FoldingRegion[];
}

interface MutableStructureItem {
  name: string;
  kind: StructureKind;
  startLine: number;
  endLine: number;
  selectionStart: number;
  selectionLength: number;
  children: MutableStructureItem[];
}

interface OpenKeywordBlock {
  readonly name: string;
  readonly startLine: number;
  readonly selectionStart: number;
  readonly parent: MutableStructureItem;
}

interface LexicalState {
  inDocumentation: boolean;
  inContinuedString: boolean;
}

const sectionPattern =
  /^(\s*)(global|builtin|init|loop|bailout|perturbinit|perturbloop|default|switch|transform|final|public|protected|private)(\s*):/i;
const classPattern =
  /^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*\([^)]*\))?\s*\{/i;
const entryPattern =
  /^(\s*)(?!class\b|comment\b)([^\s{};()]+)\s*(?:\([^)]*\))?\s*\{/i;
const functionPattern =
  /\bfunc\s+(@?[A-Za-z_][A-Za-z0-9_]*)/i;
const parameterPattern =
  /\bparam\s+(@?[A-Za-z_][A-Za-z0-9_]*)/i;

function maskNonCode(line: string, state: LexicalState): string {
  const masked = [...line];

  if (state.inDocumentation) {
    masked.fill(" ");
    if (/^\s*\}\s*(?:;.*)?$/u.test(line)) {
      state.inDocumentation = false;
    }
    return masked.join("");
  }

  if (/^\s*comment\s*\{/iu.test(line)) {
    masked.fill(" ");
    state.inDocumentation = !/^\s*comment\s*\{\s*\}\s*(?:;.*)?$/iu.test(line);
    return masked.join("");
  }

  let inString = state.inContinuedString;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (inString) {
      masked[index] = " ";
      if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === ";") {
      masked.fill(" ", index);
      break;
    }
    if (character === '"') {
      masked[index] = " ";
      inString = true;
    }
  }

  state.inContinuedString = inString && line.endsWith("\\");
  return masked.join("");
}

const braceDelta = (line: string): number => {
  let delta = 0;
  for (const character of line) {
    if (character === "{") {
      delta += 1;
    } else if (character === "}") {
      delta -= 1;
    }
  }
  return delta;
};

const addFold = (
  regions: FoldingRegion[],
  startLine: number,
  endLine: number,
): void => {
  if (endLine > startLine) {
    regions.push({ startLine, endLine });
  }
};

export function scanStructure(source: string): StructureScan {
  const lines = source.split(/\r\n|\n|\r/u);
  const symbols: MutableStructureItem[] = [];
  const foldingRegions: FoldingRegion[] = [];
  const lexicalState: LexicalState = {
    inDocumentation: false,
    inContinuedString: false,
  };

  let braceDepth = 0;
  let root: MutableStructureItem | undefined;
  let rootDepth = 0;
  let section: MutableStructureItem | undefined;
  let documentationStart: number | undefined;
  const functions: OpenKeywordBlock[] = [];
  const parameters: OpenKeywordBlock[] = [];

  const closeSection = (endLine: number): void => {
    if (section === undefined) {
      return;
    }
    section.endLine = Math.max(section.startLine, endLine);
    addFold(foldingRegions, section.startLine, section.endLine);
    section = undefined;
  };

  const closeRoot = (endLine: number): void => {
    if (root === undefined) {
      return;
    }
    closeSection(endLine - 1);
    root.endLine = Math.max(root.startLine, endLine);
    addFold(foldingRegions, root.startLine, root.endLine);
    functions.length = 0;
    parameters.length = 0;
    root = undefined;
  };

  for (const [lineNumber, originalLine] of lines.entries()) {
    const wasInDocumentation = lexicalState.inDocumentation;
    const line = maskNonCode(originalLine, lexicalState);
    if (!wasInDocumentation && lexicalState.inDocumentation) {
      documentationStart = lineNumber;
    } else if (
      wasInDocumentation &&
      !lexicalState.inDocumentation &&
      documentationStart !== undefined
    ) {
      addFold(foldingRegions, documentationStart, lineNumber);
      documentationStart = undefined;
    }
    const depthBeforeLine = braceDepth;

    if (root === undefined && depthBeforeLine === 0) {
      const classMatch = classPattern.exec(line);
      const entryMatch = classMatch === null ? entryPattern.exec(line) : null;
      const match = classMatch ?? entryMatch;
      const name = match?.[2];
      if (match !== null && match !== undefined && name !== undefined) {
        root = {
          name,
          kind: classMatch === null ? "entry" : "class",
          startLine: lineNumber,
          endLine: lineNumber,
          selectionStart: originalLine.indexOf(name),
          selectionLength: name.length,
          children: [],
        };
        rootDepth = depthBeforeLine;
        symbols.push(root);
      }
    } else if (root !== undefined) {
      const sectionMatch = sectionPattern.exec(line);
      const sectionName = sectionMatch?.[2];
      if (sectionName !== undefined) {
        closeSection(lineNumber - 1);
        section = {
          name: sectionName.toLocaleLowerCase("en-US"),
          kind: "section",
          startLine: lineNumber,
          endLine: lineNumber,
          selectionStart: originalLine
            .toLocaleLowerCase("en-US")
            .indexOf(sectionName.toLocaleLowerCase("en-US")),
          selectionLength: sectionName.length,
          children: [],
        };
        root.children.push(section);
      }

      if (/\bendfunc\b/iu.test(line)) {
        const open = functions.pop();
        if (open !== undefined) {
          open.parent.children.push({
            name: open.name,
            kind: "function",
            startLine: open.startLine,
            endLine: lineNumber,
            selectionStart: open.selectionStart,
            selectionLength: open.name.length,
            children: [],
          });
          addFold(foldingRegions, open.startLine, lineNumber);
        }
      }
      if (/\bendparam\b/iu.test(line)) {
        const open = parameters.pop();
        if (open !== undefined) {
          addFold(foldingRegions, open.startLine, lineNumber);
        }
      }

      const parent = section ?? root;
      const functionMatch = functionPattern.exec(line);
      const functionName = functionMatch?.[1];
      if (functionName !== undefined && !/\bendfunc\b/iu.test(line)) {
        functions.push({
          name: functionName,
          startLine: lineNumber,
          selectionStart: originalLine.indexOf(functionName),
          parent,
        });
      }
      const parameterMatch = parameterPattern.exec(line);
      const parameterName = parameterMatch?.[1];
      if (parameterName !== undefined && !/\bendparam\b/iu.test(line)) {
        parameters.push({
          name: parameterName,
          startLine: lineNumber,
          selectionStart: originalLine.indexOf(parameterName),
          parent,
        });
      }
    }

    braceDepth += braceDelta(line);
    if (root !== undefined && braceDepth <= rootDepth) {
      closeRoot(lineNumber);
    }
  }

  if (root !== undefined) {
    closeSection(lines.length - 1);
    root.endLine = lines.length - 1;
  }

  foldingRegions.sort(
    (left, right) =>
      left.startLine - right.startLine || right.endLine - left.endLine,
  );
  return { symbols, foldingRegions };
}
