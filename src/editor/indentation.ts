import { scanStructure } from "./structure";

export interface IndentationAdjustment {
  readonly previousLine: string;
  readonly nextLine: string;
}

interface KeywordPair {
  readonly opener: RegExp;
  readonly closer: RegExp;
  readonly nestingCloser?: RegExp;
  readonly opensNextLine: boolean;
}

const section =
  /^(?:global|builtin|init|loop|bailout|perturbinit|perturbloop|default|switch|transform|final|public|protected|private)\s*:/iu;

const keywordPairs: readonly KeywordPair[] = [
  {
    opener: /^if\b/iu,
    closer: /^endif\b/iu,
    opensNextLine: false,
  },
  {
    opener: /^if\b/iu,
    closer: /^(?:elseif|else)\b/iu,
    nestingCloser: /^endif\b/iu,
    opensNextLine: true,
  },
  {
    opener: /^while\b/iu,
    closer: /^endwhile\b/iu,
    opensNextLine: false,
  },
  {
    opener: /^repeat\b/iu,
    closer: /^until\b/iu,
    opensNextLine: false,
  },
  {
    opener: /^(?:[A-Za-z_][A-Za-z0-9_]*\s+)?func\b/iu,
    closer: /^endfunc\b/iu,
    opensNextLine: false,
  },
  {
    opener: /^(?:(?:bool|int|float|complex|color|Object|Image)\s+)?param\b/iu,
    closer: /^endparam\b/iu,
    opensNextLine: false,
  },
  {
    opener: /^heading\b/iu,
    closer: /^endheading\b/iu,
    opensNextLine: false,
  },
];

const leadingWhitespace = (line: string): string => /^\s*/u.exec(line)?.[0] ?? "";

function findMatchingOpener(
  lines: readonly string[],
  lineNumber: number,
  pair: KeywordPair,
): string | undefined {
  let nested = 0;
  const nestingCloser = pair.nestingCloser ?? pair.closer;
  for (let candidate = lineNumber - 1; candidate >= 0; candidate -= 1) {
    const line = lines[candidate];
    if (line === undefined) {
      continue;
    }
    const trimmed = line.trimStart();
    if (nestingCloser.test(trimmed)) {
      nested += 1;
    } else if (pair.opener.test(trimmed)) {
      if (nested === 0) {
        return leadingWhitespace(line);
      }
      nested -= 1;
    }
  }
  return undefined;
}

function fallbackOutdent(whitespace: string, indentUnit: string): string {
  if (whitespace.endsWith("\t")) {
    return whitespace.slice(0, -1);
  }
  const width = Math.max(1, indentUnit.length);
  return whitespace.slice(0, Math.max(0, whitespace.length - width));
}

export function indentationAdjustmentAfterNewline(
  source: string,
  previousLineNumber: number,
  indentUnit: string,
): IndentationAdjustment | undefined {
  const lines = source.split(/\r\n|\n|\r/u);
  const line = lines[previousLineNumber];
  if (line === undefined) {
    return undefined;
  }
  const trimmed = line.trimStart();
  const currentWhitespace = leadingWhitespace(line);

  if (section.test(trimmed)) {
    const containingRoot = scanStructure(source).symbols.find(
      ({ startLine, endLine }) =>
        startLine < previousLineNumber && endLine >= previousLineNumber,
    );
    const rootLine =
      containingRoot === undefined ? undefined : lines[containingRoot.startLine];
    const target =
      rootLine === undefined
        ? fallbackOutdent(currentWhitespace, indentUnit)
        : leadingWhitespace(rootLine);
    return { previousLine: target, nextLine: target + indentUnit };
  }

  if (/^\}/u.test(trimmed)) {
    const matchingRoot = scanStructure(source).symbols.find(
      ({ startLine, endLine }) =>
        startLine < previousLineNumber && endLine === previousLineNumber,
    );
    const rootLine =
      matchingRoot === undefined ? undefined : lines[matchingRoot.startLine];
    const target =
      rootLine === undefined
        ? fallbackOutdent(currentWhitespace, indentUnit)
        : leadingWhitespace(rootLine);
    return { previousLine: target, nextLine: target };
  }

  const pair = keywordPairs.find(({ closer }) => closer.test(trimmed));
  if (pair === undefined) {
    return undefined;
  }
  const target =
    findMatchingOpener(lines, previousLineNumber, pair) ??
    fallbackOutdent(currentWhitespace, indentUnit);
  return {
    previousLine: target,
    nextLine: pair.opensNextLine ? target + indentUnit : target,
  };
}
