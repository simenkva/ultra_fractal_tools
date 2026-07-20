import { SourceMap, type PhysicalLine } from "./source";
import {
  DIAGNOSTIC_RULES,
  type BlockKind,
  type DeclarationNode,
  type ParseResult,
  type ProgramNode,
  type SourceRange,
  type StructuralIssue,
  type Token,
} from "./types";

const classPattern = /^(\s*)class\s+([^\s{};()]+)\s*(?:\([^)]*\))?\s*\{/iu;
const entryPattern = /^(\s*)(?!class\b|comment\b)([^\s{};()]+)\s*(?:\([^)]*\))?\s*\{/iu;
const sectionPattern = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)?\s*:/u;
const functionPattern = /\bfunc\s+(@?[A-Za-z_][A-Za-z0-9_]*)/iu;
const parameterPattern = /\bparam\s+(@?[A-Za-z_][A-Za-z0-9_]*)/iu;
const importPattern = /\bimport\b/iu;
const variablePattern = /^(\s*)(?:(?:const|static)\s+)*([A-Za-z_][A-Za-z0-9_]*)\s+(@?[A-Za-z_][A-Za-z0-9_]*)\b/iu;

const delimiterPairs = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);
const closingDelimiters = new Map([
  [")", "("],
  ["]", "["],
  ["}", "{"],
]);

const blockOpeners = new Map<string, BlockKind>([
  ["if", "if"],
  ["while", "while"],
  ["repeat", "repeat"],
  ["func", "function"],
  ["param", "parameter"],
  ["heading", "heading"],
]);
const blockClosers = new Map<string, BlockKind>([
  ["endif", "if"],
  ["endwhile", "while"],
  ["until", "repeat"],
  ["endfunc", "function"],
  ["endparam", "parameter"],
  ["endheading", "heading"],
]);
const expectedCloser = new Map<BlockKind, string>([
  ["if", "endif"],
  ["while", "endwhile"],
  ["repeat", "until"],
  ["function", "endfunc"],
  ["parameter", "endparam"],
  ["heading", "endheading"],
]);
const expectedOpener = new Map<BlockKind, string>([
  ["if", "if"],
  ["while", "while"],
  ["repeat", "repeat"],
  ["function", "func"],
  ["parameter", "param"],
  ["heading", "heading"],
]);

const nonVariableStarters = new Set([
  "class",
  "else",
  "elseif",
  "endfunc",
  "endheading",
  "endif",
  "endparam",
  "endwhile",
  "func",
  "heading",
  "if",
  "import",
  "new",
  "param",
  "repeat",
  "return",
  "until",
  "while",
]);

interface MutableBlockNode {
  kind: BlockKind;
  name?: string;
  range: SourceRange;
  openerRange: SourceRange;
  closerRange?: SourceRange;
  children: MutableBlockNode[];
  sawElse?: boolean;
}

interface MutableSectionNode {
  kind: "section";
  name: string;
  range: SourceRange;
  labelRange: SourceRange;
  declarations: DeclarationNode[];
  blocks: MutableBlockNode[];
}

interface MutableDefinitionNode {
  kind: "entry" | "class";
  name: string;
  range: SourceRange;
  nameRange: SourceRange;
  sections: MutableSectionNode[];
  declarations: DeclarationNode[];
  blocks: MutableBlockNode[];
}

interface OpenDelimiter {
  readonly text: string;
  readonly range: SourceRange;
}

interface DirectiveFrame {
  readonly token: Token;
  sawElse: boolean;
}

const lower = (value: string): string => value.toLocaleLowerCase("en-US");

const lastIndexWhere = <T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
): number => {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== undefined && predicate(value)) {
      return index;
    }
  }
  return -1;
};

const issue = (
  range: SourceRange,
  rule: StructuralIssue["rule"],
  message: string,
): StructuralIssue => ({ range, rule, message });

const tokensByLine = (
  tokens: readonly Token[],
  lineCount: number,
): readonly Token[][] => {
  const result: Token[][] = Array.from({ length: lineCount }, () => []);
  for (const current of tokens) {
    const line = result[current.range.start.line];
    line?.push(current);
  }
  return result;
};

const maskNonCode = (line: PhysicalLine, tokens: readonly Token[]): string => {
  const characters = [...line.text];
  for (const current of tokens) {
    if (
      current.kind !== "comment" &&
      !(current.kind === "literal" && current.literalKind === "string")
    ) {
      continue;
    }
    const start = Math.max(0, current.range.start.character);
    const end = Math.min(characters.length, current.range.end.character);
    characters.fill(" ", start, end);
  }
  return characters.join("");
};

const lineRange = (map: SourceMap, line: PhysicalLine): SourceRange => {
  const firstContent = line.text.search(/\S/u);
  const start = firstContent < 0 ? line.startOffset : line.startOffset + firstContent;
  return map.range(start, line.startOffset + line.text.length);
};

const namedRange = (
  map: SourceMap,
  line: PhysicalLine,
  character: number,
  length: number,
): SourceRange =>
  map.range(
    line.startOffset + character,
    line.startOffset + character + length,
  );

const checkDelimiters = (
  tokens: readonly Token[],
  issues: StructuralIssue[],
): void => {
  const stack: OpenDelimiter[] = [];
  for (const current of tokens) {
    if (current.kind !== "symbol") {
      continue;
    }
    if (delimiterPairs.has(current.text)) {
      stack.push({ text: current.text, range: current.range });
      continue;
    }
    const matchingOpener = closingDelimiters.get(current.text);
    if (matchingOpener === undefined) {
      continue;
    }
    const open = stack.at(-1);
    if (open === undefined) {
      issues.push(
        issue(
          current.range,
          DIAGNOSTIC_RULES.delimiterMismatch,
          `Unmatched closing delimiter '${current.text}'; expected a matching '${matchingOpener}' earlier.`,
        ),
      );
      continue;
    }
    const expected = delimiterPairs.get(open.text);
    if (open.text === matchingOpener) {
      stack.pop();
      continue;
    }

    const matchingIndex = lastIndexWhere(
      stack,
      (candidate) => candidate.text === matchingOpener,
    );
    if (matchingIndex < 0) {
      issues.push(
        issue(
          current.range,
          DIAGNOSTIC_RULES.delimiterMismatch,
          `Unmatched closing delimiter '${current.text}'; expected a matching '${matchingOpener}' earlier.`,
        ),
      );
      continue;
    }
    issues.push(
      issue(
        current.range,
        DIAGNOSTIC_RULES.delimiterMismatch,
        `Mismatched closing delimiter '${current.text}'; expected '${expected ?? "matching delimiter"}' to match '${open.text}'.`,
      ),
    );
    stack.splice(matchingIndex);
  }

  for (const open of stack) {
    issues.push(
      issue(
        open.range,
        DIAGNOSTIC_RULES.delimiterMismatch,
        `Unclosed delimiter '${open.text}'; expected '${delimiterPairs.get(open.text) ?? "matching delimiter"}'.`,
      ),
    );
  }
};

const checkDirectives = (
  tokens: readonly Token[],
  issues: StructuralIssue[],
): void => {
  const stack: DirectiveFrame[] = [];
  for (const current of tokens) {
    if (current.kind !== "directive") {
      continue;
    }
    const name = lower(current.text);
    if (name === "$ifdef") {
      stack.push({ token: current, sawElse: false });
    } else if (name === "$else") {
      const frame = stack.at(-1);
      if (frame === undefined) {
        issues.push(
          issue(
            current.range,
            DIAGNOSTIC_RULES.directiveNesting,
            "Unexpected '$else' directive; expected a matching '$ifdef' earlier.",
          ),
        );
      } else if (frame.sawElse) {
        issues.push(
          issue(
            current.range,
            DIAGNOSTIC_RULES.directiveNesting,
            "Duplicate '$else' directive; expected '$endif' for the current '$ifdef'.",
          ),
        );
      } else {
        frame.sawElse = true;
      }
    } else if (name === "$endif") {
      if (stack.length === 0) {
        issues.push(
          issue(
            current.range,
            DIAGNOSTIC_RULES.directiveNesting,
            "Unexpected '$endif' directive; expected a matching '$ifdef' earlier.",
          ),
        );
      } else {
        stack.pop();
      }
    }
  }

  for (const frame of stack) {
    issues.push(
      issue(
        frame.token.range,
        DIAGNOSTIC_RULES.directiveNesting,
        "Unclosed '$ifdef' directive; expected '$endif'.",
      ),
    );
  }
};

const tokenGroupsInsideDefinitions = (
  tokens: readonly Token[],
  definitions: readonly MutableDefinitionNode[],
): readonly (readonly Token[])[] => {
  const groups: Token[][] = definitions.map(() => []);
  let definitionIndex = 0;
  for (const current of tokens) {
    while (
      definitionIndex < definitions.length &&
      current.range.start.offset >=
        (definitions[definitionIndex]?.range.end.offset ?? Number.POSITIVE_INFINITY)
    ) {
      definitionIndex += 1;
    }
    const definition = definitions[definitionIndex];
    if (
      definition === undefined ||
      current.range.start.offset < definition.range.start.offset ||
      current.range.end.offset > definition.range.end.offset ||
      (current.range.start.offset >= definition.nameRange.start.offset &&
        current.range.end.offset <= definition.nameRange.end.offset)
    ) {
      continue;
    }
    groups[definitionIndex]?.push(current);
  }
  return groups;
};

const blockName = (kind: BlockKind, maskedLine: string): string | undefined => {
  if (kind === "function") {
    return functionPattern.exec(maskedLine)?.[1];
  }
  if (kind === "parameter") {
    return parameterPattern.exec(maskedLine)?.[1];
  }
  return undefined;
};

const closeOpenBlocks = (
  blocks: MutableBlockNode[],
  endRange: SourceRange,
  issues: StructuralIssue[],
  context: string,
): void => {
  for (const open of blocks) {
    open.range = { start: open.range.start, end: endRange.start };
    issues.push(
      issue(
        open.openerRange,
        DIAGNOSTIC_RULES.blockMismatch,
        `Unclosed '${expectedOpener.get(open.kind) ?? open.kind}' block; expected '${expectedCloser.get(open.kind) ?? "matching closer"}' before ${context}.`,
      ),
    );
  }
  blocks.length = 0;
};

const addDeclaration = (
  map: SourceMap,
  line: PhysicalLine,
  maskedLine: string,
  lineTokens: readonly Token[],
  target: DeclarationNode[],
): void => {
  const functionMatch = functionPattern.exec(maskedLine);
  const parameterMatch = parameterPattern.exec(maskedLine);
  if (functionMatch?.[1] !== undefined) {
    const name = functionMatch[1];
    const index = maskedLine.indexOf(name, functionMatch.index);
    target.push({
      kind: "function",
      name,
      range: lineRange(map, line),
      nameRange: namedRange(map, line, index, name.length),
    });
    return;
  }
  if (parameterMatch?.[1] !== undefined) {
    const name = parameterMatch[1];
    const index = maskedLine.indexOf(name, parameterMatch.index);
    target.push({
      kind: "parameter",
      name,
      range: lineRange(map, line),
      nameRange: namedRange(map, line, index, name.length),
    });
    return;
  }
  if (importPattern.test(maskedLine)) {
    const importToken = lineTokens.find(
      (current) => current.kind === "identifier" && lower(current.text) === "import",
    );
    const pathToken = lineTokens.find(
      (current) =>
        current.kind === "literal" &&
        current.literalKind === "string" &&
        importToken !== undefined &&
        current.range.start.offset > importToken.range.end.offset,
    );
    if (pathToken !== undefined) {
      const quoted = pathToken.text;
      const importPath =
        quoted.startsWith('"') && quoted.endsWith('"')
          ? quoted.slice(1, -1)
          : quoted;
      target.push({
        kind: "import",
        importPath,
        range: lineRange(map, line),
        nameRange: pathToken.range,
      });
    }
    return;
  }

  const variableMatch = variablePattern.exec(maskedLine);
  const typeName = variableMatch?.[2];
  const name = variableMatch?.[3];
  if (
    typeName === undefined ||
    name === undefined ||
    nonVariableStarters.has(lower(typeName))
  ) {
    return;
  }
  const nameIndex = maskedLine.indexOf(
    name,
    (variableMatch?.index ?? 0) + typeName.length,
  );
  target.push({
    kind: "variable",
    name,
    range: lineRange(map, line),
    nameRange: namedRange(map, line, nameIndex, name.length),
  });
};

const processBlocks = (
  map: SourceMap,
  maskedLine: string,
  lineTokens: readonly Token[],
  target: MutableBlockNode[],
  stack: MutableBlockNode[],
  issues: StructuralIssue[],
): void => {
  for (const current of lineTokens) {
    if (current.kind !== "identifier" || current.text.startsWith("@")) {
      continue;
    }
    const keyword = lower(current.text);
    if (keyword === "else" || keyword === "elseif") {
      const open = stack.at(-1);
      if (open?.kind !== "if") {
        const expected =
          open === undefined
            ? "an 'if' opener earlier"
            : `'${expectedCloser.get(open.kind) ?? "matching closer"}' before '${keyword}'`;
        issues.push(
          issue(
            current.range,
            DIAGNOSTIC_RULES.blockMismatch,
            `Unexpected '${keyword}'; expected ${expected}.`,
          ),
        );
      } else if (open.sawElse) {
        issues.push(
          issue(
            current.range,
            DIAGNOSTIC_RULES.blockMismatch,
            `Unexpected '${keyword}' after 'else'; expected 'endif'.`,
          ),
        );
      } else if (keyword === "else") {
        open.sawElse = true;
      }
      continue;
    }

    const openingKind = blockOpeners.get(keyword);
    if (openingKind !== undefined) {
      const declarationMatch =
        openingKind === "function"
          ? functionPattern.exec(maskedLine)
          : openingKind === "parameter"
            ? parameterPattern.exec(maskedLine)
            : undefined;
      if (
        declarationMatch !== undefined &&
        declarationMatch !== null &&
        /^\s*=/u.test(
          maskedLine.slice(declarationMatch.index + declarationMatch[0].length),
        )
      ) {
        continue;
      }
      const block: MutableBlockNode = {
        kind: openingKind,
        range: { start: current.range.start, end: map.positionAt(map.source.length) },
        openerRange: current.range,
        children: [],
      };
      const name = blockName(openingKind, maskedLine);
      if (name !== undefined) {
        block.name = name;
      }
      const parent = stack.at(-1);
      (parent?.children ?? target).push(block);
      stack.push(block);
      continue;
    }

    const closingKind = blockClosers.get(keyword);
    if (closingKind === undefined) {
      continue;
    }
    const open = stack.at(-1);
    if (open === undefined) {
      issues.push(
        issue(
          current.range,
          DIAGNOSTIC_RULES.blockMismatch,
          `Unexpected '${keyword}'; expected '${expectedOpener.get(closingKind) ?? closingKind}' before it.`,
        ),
      );
      continue;
    }
    if (open.kind === closingKind) {
      open.closerRange = current.range;
      open.range = { start: open.range.start, end: current.range.end };
      stack.pop();
      continue;
    }

    issues.push(
      issue(
        current.range,
        DIAGNOSTIC_RULES.blockMismatch,
        `Mismatched '${keyword}'; expected '${expectedCloser.get(open.kind) ?? "matching closer"}' to close '${expectedOpener.get(open.kind) ?? open.kind}'.`,
      ),
    );
    const matchingIndex = lastIndexWhere(
      stack,
      (candidate) => candidate.kind === closingKind,
    );
    if (matchingIndex >= 0) {
      const matched = stack[matchingIndex];
      if (matched !== undefined) {
        matched.closerRange = current.range;
        matched.range = { start: matched.range.start, end: current.range.end };
      }
      stack.splice(matchingIndex);
    }
  }
};

export function parse(source: string, tokens: readonly Token[]): ParseResult {
  const map = new SourceMap(source);
  const perLine = tokensByLine(tokens, map.lines.length);
  const issues: StructuralIssue[] = [];
  const definitions: MutableDefinitionNode[] = [];
  const blockStack: MutableBlockNode[] = [];
  let braceDepth = 0;
  let definition: MutableDefinitionNode | undefined;
  let definitionDepth = 0;
  let section: MutableSectionNode | undefined;

  const closeSection = (endOffset: number): void => {
    if (section !== undefined) {
      section.range = {
        start: section.range.start,
        end: map.positionAt(endOffset),
      };
      section = undefined;
    }
  };

  const closeDefinition = (closingRange: SourceRange): void => {
    if (definition === undefined) {
      return;
    }
    closeOpenBlocks(blockStack, closingRange, issues, "the entry's closing brace");
    closeSection(closingRange.start.offset);
    definition.range = {
      start: definition.range.start,
      end: closingRange.end,
    };
    definition = undefined;
  };

  for (const line of map.lines) {
    const lineTokens = perLine[line.number] ?? [];
    const maskedLine = maskNonCode(line, lineTokens);
    const depthBeforeLine = braceDepth;
    let openedDefinition = false;

    if (definition === undefined && depthBeforeLine === 0) {
      const classMatch = classPattern.exec(maskedLine);
      const entryMatch = classMatch === null ? entryPattern.exec(maskedLine) : null;
      const match = classMatch ?? entryMatch;
      const name = match?.[2];
      if (match !== null && match !== undefined && name !== undefined) {
        const nameCharacter = maskedLine.indexOf(name, match.index);
        const nameRange = namedRange(map, line, nameCharacter, name.length);
        definition = {
          kind: classMatch === null ? "entry" : "class",
          name,
          range: {
            start: nameRange.start,
            end: map.positionAt(source.length),
          },
          nameRange,
          sections: [],
          declarations: [],
          blocks: [],
        };
        definitionDepth = depthBeforeLine;
        definitions.push(definition);
        openedDefinition = true;
      }
    }

    if (definition !== undefined && !openedDefinition) {
      if (depthBeforeLine === definitionDepth + 1) {
        const sectionMatch = sectionPattern.exec(maskedLine);
        const label = sectionMatch?.[2] ?? "";
        if (sectionMatch !== null) {
          closeSection(line.startOffset);
          const colonCharacter = maskedLine.indexOf(":", sectionMatch.index);
          const labelCharacter =
            label.length > 0
              ? maskedLine.indexOf(label, sectionMatch.index)
              : colonCharacter;
          const labelLength = label.length > 0 ? label.length : 1;
          const labelRange = namedRange(
            map,
            line,
            labelCharacter,
            labelLength,
          );
          section = {
            kind: "section",
            name: label,
            range: {
              start: labelRange.start,
              end: map.positionAt(source.length),
            },
            labelRange,
            declarations: [],
            blocks: [],
          };
          definition.sections.push(section);
        }
      }

      const declarationTarget = section?.declarations ?? definition.declarations;
      addDeclaration(map, line, maskedLine, lineTokens, declarationTarget);
      const blockTarget = section?.blocks ?? definition.blocks;
      processBlocks(
        map,
        maskedLine,
        lineTokens,
        blockTarget,
        blockStack,
        issues,
      );
    }

    const symbols = lineTokens.filter(
      (current) => current.kind === "symbol" && (current.text === "{" || current.text === "}"),
    );
    for (const symbol of symbols) {
      braceDepth += symbol.text === "{" ? 1 : -1;
      if (
        definition !== undefined &&
        symbol.text === "}" &&
        braceDepth <= definitionDepth
      ) {
        closeDefinition(symbol.range);
      }
    }
  }

  if (definition !== undefined) {
    const eofRange = map.range(source.length, source.length);
    closeOpenBlocks(blockStack, eofRange, issues, "the end of the file");
    closeSection(source.length);
    definition.range = {
      start: definition.range.start,
      end: eofRange.end,
    };
  }

  const program: ProgramNode = {
    kind: "program",
    range: map.range(0, source.length),
    definitions,
  };
  for (const structuralTokens of tokenGroupsInsideDefinitions(
    tokens,
    definitions,
  )) {
    checkDelimiters(structuralTokens, issues);
    checkDirectives(structuralTokens, issues);
  }
  return { program, issues };
}
