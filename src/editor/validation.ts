import {
  DIAGNOSTIC_RULES,
  type Diagnostic,
  type DiagnosticRule,
} from "../analyzer";

export type DisplaySeverity = "error" | "warning" | "information" | "hint";
export type SeverityOverride = DisplaySeverity | "off";

export interface RawValidationSettings {
  readonly enabled?: unknown;
  readonly debounceMilliseconds?: unknown;
  readonly maxDiagnostics?: unknown;
  readonly severityOverrides?: unknown;
  readonly formulaSearchPaths?: unknown;
}

export interface ValidationSettings {
  readonly enabled: boolean;
  readonly debounceMilliseconds: number;
  readonly maxDiagnostics: number;
  readonly severityOverrides: ReadonlyMap<DiagnosticRule, SeverityOverride>;
  readonly formulaSearchPaths: readonly string[];
}

export interface DisplayDiagnostic extends Diagnostic {
  readonly displaySeverity: DisplaySeverity;
}

const diagnosticRules = new Set<string>(Object.values(DIAGNOSTIC_RULES));
const severityOverrides = new Set<SeverityOverride>([
  "error",
  "warning",
  "information",
  "hint",
  "off",
]);

const boundedInteger = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
};

const normalizeOverrides = (
  value: unknown,
): ReadonlyMap<DiagnosticRule, SeverityOverride> => {
  const result = new Map<DiagnosticRule, SeverityOverride>();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return result;
  }
  for (const [rule, severity] of Object.entries(value)) {
    if (
      diagnosticRules.has(rule) &&
      typeof severity === "string" &&
      severityOverrides.has(severity as SeverityOverride)
    ) {
      result.set(rule as DiagnosticRule, severity as SeverityOverride);
    }
  }
  return result;
};

const normalizeSearchPaths = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }
    const trimmed = candidate.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
};

export function normalizeValidationSettings(
  raw: RawValidationSettings,
): ValidationSettings {
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    debounceMilliseconds: boundedInteger(
      raw.debounceMilliseconds,
      300,
      0,
      5_000,
    ),
    maxDiagnostics: boundedInteger(raw.maxDiagnostics, 100, 1, 1_000),
    severityOverrides: normalizeOverrides(raw.severityOverrides),
    formulaSearchPaths: normalizeSearchPaths(raw.formulaSearchPaths),
  };
}

export const disabledDiagnosticRules = (
  settings: ValidationSettings,
): readonly DiagnosticRule[] =>
  [...settings.severityOverrides.entries()]
    .filter(([, severity]) => severity === "off")
    .map(([rule]) => rule);

export function selectDisplayDiagnostics(
  diagnostics: readonly Diagnostic[],
  settings: ValidationSettings,
): readonly DisplayDiagnostic[] {
  const selected: DisplayDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const override = settings.severityOverrides.get(diagnostic.rule);
    if (override === "off") {
      continue;
    }
    selected.push({
      ...diagnostic,
      displaySeverity: override ?? diagnostic.severity,
    });
    if (selected.length >= settings.maxDiagnostics) {
      break;
    }
  }
  return selected;
}
