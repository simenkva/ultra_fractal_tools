export type FormulaFileType = "ufm" | "ucl" | "uxf" | "ulb";

export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly character: number;
}

export interface SourceRange {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export type TokenKind =
  | "identifier"
  | "literal"
  | "symbol"
  | "comment"
  | "directive"
  | "newline"
  | "line-continuation";

export type LiteralKind = "string" | "number" | "boolean";

export interface Token {
  readonly kind: TokenKind;
  readonly literalKind?: LiteralKind;
  readonly text: string;
  readonly range: SourceRange;
}

export const DIAGNOSTIC_RULES = {
  unterminatedString: "UF1001",
  delimiterMismatch: "UF1002",
  blockMismatch: "UF1003",
  directiveNesting: "UF1004",
  duplicateDefinition: "UF1005",
  illegalSection: "UF1006",
  sectionOrder: "UF2001",
  duplicateParameter: "UF2002",
  missingImport: "UF2003",
  legacySyntax: "UF2004",
} as const;

export type DiagnosticRule =
  (typeof DIAGNOSTIC_RULES)[keyof typeof DIAGNOSTIC_RULES];

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  readonly rule: DiagnosticRule;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly range: SourceRange;
}

export interface StructuralIssue {
  readonly rule: DiagnosticRule;
  readonly message: string;
  readonly range: SourceRange;
}

export type DeclarationKind =
  | "variable"
  | "function"
  | "parameter"
  | "import";

export interface DeclarationNode {
  readonly kind: DeclarationKind;
  readonly name?: string;
  readonly importPath?: string;
  readonly range: SourceRange;
  readonly nameRange?: SourceRange;
}

export type BlockKind =
  | "if"
  | "while"
  | "repeat"
  | "function"
  | "parameter"
  | "heading";

export interface BlockNode {
  readonly kind: BlockKind;
  readonly name?: string;
  readonly range: SourceRange;
  readonly openerRange: SourceRange;
  readonly closerRange?: SourceRange;
  readonly children: readonly BlockNode[];
}

export interface SectionNode {
  readonly kind: "section";
  readonly name: string;
  readonly range: SourceRange;
  readonly labelRange: SourceRange;
  readonly declarations: readonly DeclarationNode[];
  readonly blocks: readonly BlockNode[];
}

export interface DefinitionNode {
  readonly kind: "entry" | "class";
  readonly name: string;
  readonly range: SourceRange;
  readonly nameRange: SourceRange;
  readonly sections: readonly SectionNode[];
  readonly declarations: readonly DeclarationNode[];
  readonly blocks: readonly BlockNode[];
}

export interface ProgramNode {
  readonly kind: "program";
  readonly range: SourceRange;
  readonly definitions: readonly DefinitionNode[];
}

export interface LexResult {
  readonly tokens: readonly Token[];
  readonly issues: readonly StructuralIssue[];
}

export interface ParseResult {
  readonly program: ProgramNode;
  readonly issues: readonly StructuralIssue[];
}

export type ImportResolution = "found" | "missing" | "unchecked";

export interface AnalysisOptions {
  readonly fileType: FormulaFileType;
  readonly disabledRules?: readonly DiagnosticRule[];
  readonly resolveImport?: (importPath: string) => ImportResolution;
}

export interface AnalysisResult {
  readonly program: ProgramNode;
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly Diagnostic[];
}
