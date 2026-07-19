import { UF6_CATALOG } from "../catalog/uf6";
import { lex } from "./lexer";
import { parse } from "./parser";
import {
  DIAGNOSTIC_RULES,
  type AnalysisOptions,
  type AnalysisResult,
  type DeclarationNode,
  type DefinitionNode,
  type Diagnostic,
  type DiagnosticRule,
  type DiagnosticSeverity,
  type SectionNode,
  type StructuralIssue,
} from "./types";

export interface DiagnosticRuleDescription {
  readonly rule: DiagnosticRule;
  readonly severity: DiagnosticSeverity;
  readonly summary: string;
}

export const DIAGNOSTIC_RULE_DESCRIPTIONS: readonly DiagnosticRuleDescription[] = [
  {
    rule: DIAGNOSTIC_RULES.unterminatedString,
    severity: "error",
    summary: "String literal has no closing quote or valid line continuation.",
  },
  {
    rule: DIAGNOSTIC_RULES.delimiterMismatch,
    severity: "error",
    summary: "Parentheses, brackets, or braces are unmatched or mismatched.",
  },
  {
    rule: DIAGNOSTIC_RULES.blockMismatch,
    severity: "error",
    summary: "A language block has no matching opener or closer.",
  },
  {
    rule: DIAGNOSTIC_RULES.directiveNesting,
    severity: "error",
    summary: "Compiler directive nesting is structurally invalid.",
  },
  {
    rule: DIAGNOSTIC_RULES.duplicateDefinition,
    severity: "error",
    summary: "An entry or class identifier is repeated in one file.",
  },
  {
    rule: DIAGNOSTIC_RULES.illegalSection,
    severity: "error",
    summary: "A section is not legal for the selected formula file type.",
  },
  {
    rule: DIAGNOSTIC_RULES.sectionOrder,
    severity: "warning",
    summary: "A legal section appears in a suspicious order.",
  },
  {
    rule: DIAGNOSTIC_RULES.duplicateParameter,
    severity: "warning",
    summary: "A parameter block name is repeated in one definition.",
  },
  {
    rule: DIAGNOSTIC_RULES.missingImport,
    severity: "warning",
    summary: "An import resolver checked every location and found no file.",
  },
  {
    rule: DIAGNOSTIC_RULES.legacySyntax,
    severity: "warning",
    summary: "Accepted compatibility syntax is discouraged in new formulas.",
  },
];

const severityByRule = new Map(
  DIAGNOSTIC_RULE_DESCRIPTIONS.map(({ rule, severity }) => [rule, severity]),
);

const lower = (value: string): string => value.toLocaleLowerCase("en-US");

const diagnostic = (
  value: StructuralIssue,
): Diagnostic => ({
  ...value,
  severity: severityByRule.get(value.rule) ?? "warning",
});

const declarationsIn = (
  definition: DefinitionNode,
): readonly DeclarationNode[] => [
  ...definition.declarations,
  ...definition.sections.flatMap((section) => section.declarations),
];

const effectiveSectionName = (
  section: SectionNode,
  options: AnalysisOptions,
  definition: DefinitionNode,
): string =>
  section.name.length === 0 &&
  options.fileType === "ufm" &&
  definition.kind === "entry"
    ? "loop"
    : lower(section.name);

const diagnoseDefinitions = (
  definitions: readonly DefinitionNode[],
): StructuralIssue[] => {
  const issues: StructuralIssue[] = [];
  const firstByName = new Map<string, DefinitionNode>();
  for (const definition of definitions) {
    const key = lower(definition.name);
    const first = firstByName.get(key);
    if (first === undefined) {
      firstByName.set(key, definition);
      continue;
    }
    issues.push({
      rule: DIAGNOSTIC_RULES.duplicateDefinition,
      message: `Duplicate ${definition.kind} identifier '${definition.name}'; expected a unique identifier in this file (first declared on line ${first.nameRange.start.line + 1}).`,
      range: definition.nameRange,
    });
  }
  return issues;
};

const diagnoseSections = (
  definitions: readonly DefinitionNode[],
  options: AnalysisOptions,
): StructuralIssue[] => {
  const issues: StructuralIssue[] = [];
  for (const definition of definitions) {
    const sectionType = definition.kind === "class" ? "ulb" : options.fileType;
    const specification = UF6_CATALOG.sectionOrders[sectionType].values[0];
    if (specification === undefined) {
      continue;
    }
    const legalSections = specification.sections.map(lower);
    const indexes = new Map(
      legalSections.map((name, index) => [name, index] as const),
    );
    let greatestIndex = -1;
    let lastSection: SectionNode | undefined;
    for (const section of definition.sections) {
      const name = effectiveSectionName(section, options, definition);
      if (
        section.name.length === 0 &&
        options.fileType === "ufm" &&
        definition.kind === "entry"
      ) {
        issues.push({
          rule: DIAGNOSTIC_RULES.legacySyntax,
          message:
            "Legacy empty section label is accepted as 'loop:', but explicit labels are recommended for new formulas.",
          range: section.labelRange,
        });
      }

      const index = indexes.get(name);
      if (index === undefined) {
        const display = section.name.length === 0 ? ":" : `${section.name}:`;
        issues.push({
          rule: DIAGNOSTIC_RULES.illegalSection,
          message: `Section '${display}' is illegal for this ${definition.kind}; expected one of ${legalSections.map((legal) => `'${legal}:'`).join(", ")}.`,
          range: section.labelRange,
        });
        continue;
      }

      if (specification.ordered && index <= greatestIndex) {
        const previous = lastSection?.name || "the previous section";
        issues.push({
          rule: DIAGNOSTIC_RULES.sectionOrder,
          message: `Section '${name}:' appears after '${previous}:'; expected sections in the documented ${definition.kind} order.`,
          range: section.labelRange,
        });
      }
      greatestIndex = Math.max(greatestIndex, index);
      lastSection = section;
    }
  }
  return issues;
};

const diagnoseParametersAndImports = (
  definitions: readonly DefinitionNode[],
  options: AnalysisOptions,
): StructuralIssue[] => {
  const issues: StructuralIssue[] = [];
  for (const definition of definitions) {
    const firstParameter = new Map<string, DeclarationNode>();
    for (const declaration of declarationsIn(definition)) {
      if (declaration.kind === "parameter" && declaration.name !== undefined) {
        const key = lower(declaration.name.replace(/^@/u, ""));
        const first = firstParameter.get(key);
        if (first === undefined) {
          firstParameter.set(key, declaration);
        } else {
          issues.push({
            rule: DIAGNOSTIC_RULES.duplicateParameter,
            message: `Duplicate parameter declaration '${declaration.name}'; expected a unique parameter name in '${definition.name}' (first declared on line ${(first.nameRange?.start.line ?? first.range.start.line) + 1}).`,
            range: declaration.nameRange ?? declaration.range,
          });
        }
      }

      if (
        declaration.kind !== "import" ||
        declaration.importPath === undefined ||
        options.resolveImport === undefined
      ) {
        continue;
      }
      let resolution = "unchecked";
      try {
        resolution = options.resolveImport(declaration.importPath);
      } catch {
        resolution = "unchecked";
      }
      if (resolution === "missing") {
        issues.push({
          rule: DIAGNOSTIC_RULES.missingImport,
          message: `Imported file '${declaration.importPath}' was not found after all configured search locations were checked.`,
          range: declaration.nameRange ?? declaration.range,
        });
      }
    }
  }
  return issues;
};

export function analyze(
  source: string,
  options: AnalysisOptions,
): AnalysisResult {
  const lexed = lex(source);
  const parsed = parse(source, lexed.tokens);
  const disabled = new Set(options.disabledRules ?? []);
  const issues = [
    ...lexed.issues,
    ...parsed.issues,
    ...diagnoseDefinitions(parsed.program.definitions),
    ...diagnoseSections(parsed.program.definitions, options),
    ...diagnoseParametersAndImports(parsed.program.definitions, options),
  ];
  const diagnostics = issues
    .filter(({ rule }) => !disabled.has(rule))
    .map(diagnostic)
    .sort(
      (left, right) =>
        left.range.start.offset - right.range.start.offset ||
        left.rule.localeCompare(right.rule),
    );

  return {
    program: parsed.program,
    tokens: lexed.tokens,
    diagnostics,
  };
}
