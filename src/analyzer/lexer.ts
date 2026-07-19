import { SourceMap, type PhysicalLine } from "./source";
import {
  DIAGNOSTIC_RULES,
  type LexResult,
  type LiteralKind,
  type SourcePosition,
  type StructuralIssue,
  type Token,
  type TokenKind,
} from "./types";

const identifierPattern = /^[@#]?[A-Za-z_][A-Za-z0-9_]*/u;
const numberPattern = /^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?:i\b)?/u;
const directivePattern = /^\$[A-Za-z_][A-Za-z0-9_]*/u;
const documentationStartPattern = /^\s*comment\s*\{/iu;
const documentationEndPattern = /^\s*\}\s*(?:;.*)?$/u;
const documentationSingleLinePattern = /^\s*comment\s*\{\s*\}\s*(?:;.*)?$/iu;
const multiCharacterSymbols = new Set([
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  "+=",
  "-=",
  "*=",
  "/=",
  ":=",
  "<>",
]);

interface StringState {
  readonly start: SourcePosition;
}

const isWhitespace = (character: string | undefined): boolean =>
  character === " " || character === "\t" || character === "\f";

const hasTrailingContinuation = (text: string): boolean =>
  text.endsWith("\\");

const token = (
  map: SourceMap,
  kind: TokenKind,
  startOffset: number,
  endOffset: number,
  literalKind?: LiteralKind,
): Token => ({
  kind,
  ...(literalKind === undefined ? {} : { literalKind }),
  text: map.source.slice(startOffset, endOffset),
  range: map.range(startOffset, endOffset),
});

const unterminatedString = (
  start: SourcePosition,
  end: SourcePosition,
): StructuralIssue => ({
  rule: DIAGNOSTIC_RULES.unterminatedString,
  message: "Unterminated string literal; expected a closing double quote (\").",
  range: { start, end },
});

const scanStringSegment = (
  map: SourceMap,
  line: PhysicalLine,
  startCharacter: number,
  state: StringState,
  continuing: boolean,
  tokens: Token[],
  issues: StructuralIssue[],
): { readonly nextCharacter: number; readonly state?: StringState } => {
  let cursor = startCharacter + (!continuing && line.text[startCharacter] === '"' ? 1 : 0);
  while (cursor < line.text.length) {
    if (line.text[cursor] === '"') {
      const end = cursor + 1;
      tokens.push(
        token(
          map,
          "literal",
          line.startOffset + startCharacter,
          line.startOffset + end,
          "string",
        ),
      );
      return { nextCharacter: end };
    }
    cursor += 1;
  }

  const continuation = hasTrailingContinuation(line.text);
  const literalEnd = continuation ? line.text.length - 1 : line.text.length;
  if (literalEnd > startCharacter) {
    tokens.push(
      token(
        map,
        "literal",
        line.startOffset + startCharacter,
        line.startOffset + literalEnd,
        "string",
      ),
    );
  }
  if (continuation) {
    tokens.push(
      token(
        map,
        "line-continuation",
        line.startOffset + literalEnd,
        line.startOffset + literalEnd + 1,
      ),
    );
    return { nextCharacter: line.text.length, state };
  }

  issues.push(
    unterminatedString(
      state.start,
      map.positionAt(line.startOffset + line.text.length),
    ),
  );
  return { nextCharacter: line.text.length };
};

export function lex(source: string): LexResult {
  const map = new SourceMap(source);
  const tokens: Token[] = [];
  const issues: StructuralIssue[] = [];
  let inDocumentation = false;
  let stringState: StringState | undefined;

  for (const line of map.lines) {
    if (inDocumentation) {
      if (line.text.length > 0) {
        tokens.push(
          token(
            map,
            "comment",
            line.startOffset,
            line.startOffset + line.text.length,
          ),
        );
      }
      if (documentationEndPattern.test(line.text)) {
        inDocumentation = false;
      }
    } else if (
      stringState === undefined &&
      documentationStartPattern.test(line.text)
    ) {
      if (line.text.length > 0) {
        tokens.push(
          token(
            map,
            "comment",
            line.startOffset,
            line.startOffset + line.text.length,
          ),
        );
      }
      inDocumentation = !documentationSingleLinePattern.test(line.text);
    } else {
      let character = 0;
      if (stringState !== undefined) {
        const result = scanStringSegment(
          map,
          line,
          character,
          stringState,
          true,
          tokens,
          issues,
        );
        character = result.nextCharacter;
        stringState = result.state;
      }

      while (character < line.text.length && stringState === undefined) {
        const current = line.text[character];
        if (isWhitespace(current)) {
          character += 1;
          continue;
        }
        if (current === ";") {
          tokens.push(
            token(
              map,
              "comment",
              line.startOffset + character,
              line.startOffset + line.text.length,
            ),
          );
          character = line.text.length;
          continue;
        }
        if (current === '"') {
          const state = {
            start: map.positionAt(line.startOffset + character),
          };
          const result = scanStringSegment(
            map,
            line,
            character,
            state,
            false,
            tokens,
            issues,
          );
          character = result.nextCharacter;
          stringState = result.state;
          continue;
        }

        const remaining = line.text.slice(character);
        const directive = directivePattern.exec(remaining)?.[0];
        if (directive !== undefined) {
          tokens.push(
            token(
              map,
              "directive",
              line.startOffset + character,
              line.startOffset + character + directive.length,
            ),
          );
          character += directive.length;
          continue;
        }

        const identifier = identifierPattern.exec(remaining)?.[0];
        if (identifier !== undefined) {
          const identifierKind =
            identifier.toLocaleLowerCase("en-US") === "true" ||
            identifier.toLocaleLowerCase("en-US") === "false"
              ? "literal"
              : "identifier";
          tokens.push(
            token(
              map,
              identifierKind,
              line.startOffset + character,
              line.startOffset + character + identifier.length,
              identifierKind === "literal" ? "boolean" : undefined,
            ),
          );
          character += identifier.length;
          continue;
        }

        const number = numberPattern.exec(remaining)?.[0];
        if (number !== undefined) {
          tokens.push(
            token(
              map,
              "literal",
              line.startOffset + character,
              line.startOffset + character + number.length,
              "number",
            ),
          );
          character += number.length;
          continue;
        }

        if (
          current === "\\" &&
          character === line.text.length - 1
        ) {
          tokens.push(
            token(
              map,
              "line-continuation",
              line.startOffset + character,
              line.startOffset + character + 1,
            ),
          );
          character += 1;
          continue;
        }

        const pair = line.text.slice(character, character + 2);
        const length = multiCharacterSymbols.has(pair) ? 2 : 1;
        tokens.push(
          token(
            map,
            "symbol",
            line.startOffset + character,
            line.startOffset + character + length,
          ),
        );
        character += length;
      }
    }

    if (line.newline.length > 0) {
      const newlineStart = line.startOffset + line.text.length;
      tokens.push(
        token(map, "newline", newlineStart, newlineStart + line.newline.length),
      );
    }
  }

  if (stringState !== undefined) {
    issues.push(
      unterminatedString(stringState.start, map.positionAt(source.length)),
    );
  }

  return { tokens, issues };
}
