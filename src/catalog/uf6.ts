export const ULTRA_FRACTAL_VERSION = "6" as const;

export interface ReferenceSource {
  readonly title: string;
  readonly url: string;
}

export interface CatalogGroup<T> {
  readonly ultraFractalVersion: typeof ULTRA_FRACTAL_VERSION;
  readonly sources: readonly ReferenceSource[];
  readonly values: readonly T[];
}

export interface SectionSpecification {
  readonly ordered: boolean;
  readonly sections: readonly string[];
  readonly notes?: string;
}

const source = (title: string, url: string): ReferenceSource => ({ title, url });

const group = <T>(
  values: readonly T[],
  ...sources: readonly ReferenceSource[]
): CatalogGroup<T> => ({
  ultraFractalVersion: ULTRA_FRACTAL_VERSION,
  sources,
  values,
});

export const UF6_SOURCES = {
  types: source(
    "Types",
    "https://www.ultrafractal.com/help/writing/language/types.html",
  ),
  keywords: source(
    "Keywords",
    "https://www.ultrafractal.com/help/writing/reference/keywords.html",
  ),
  functions: source(
    "Built-in functions",
    "https://www.ultrafractal.com/help/writing/reference/functions/functions.html",
  ),
  arithmeticFunctions: source(
    "Arithmetic built-in functions",
    "https://www.ultrafractal.com/help/toc-18-5-1-0.html",
  ),
  trigonometricFunctions: source(
    "Trigonometric built-in functions",
    "https://www.ultrafractal.com/help/toc-18-5-1-1.html",
  ),
  colorFunctions: source(
    "Color built-in functions",
    "https://www.ultrafractal.com/help/toc-18-5-1-2.html",
  ),
  conversionFunctions: source(
    "Conversion built-in functions",
    "https://www.ultrafractal.com/help/toc-18-5-1-3.html",
  ),
  miscellaneousFunctions: source(
    "Miscellaneous built-in functions",
    "https://www.ultrafractal.com/help/toc-18-5-1-4.html",
  ),
  mergingFunctions: source(
    "Merging functions",
    "https://www.ultrafractal.com/help/writing/reference/functions/merge.html",
  ),
  builtInClasses: source(
    "Built-in classes",
    "https://www.ultrafractal.com/help/toc-18-5-2.html",
  ),
  predefinedSymbols: source(
    "Predefined symbols",
    "https://www.ultrafractal.com/help/toc-18-5-3.html",
  ),
  generalSettings: source(
    "General settings",
    "https://www.ultrafractal.com/help/toc-18-5-4-0.html",
  ),
  parameterSettings: source(
    "Parameter settings",
    "https://www.ultrafractal.com/help/toc-18-5-4-1.html",
  ),
  directives: source(
    "Compiler directives",
    "https://www.ultrafractal.com/help/writing/reference/directives/compilerdirectives.html",
  ),
  classes: source(
    "Classes",
    "https://www.ultrafractal.com/help/writing/classes/classes.html",
  ),
  visibility: source(
    "Member visibility",
    "https://www.ultrafractal.com/help/writing/classes/membervisibility.html",
  ),
  fractalFormulas: source(
    "Writing fractal formulas",
    "https://www.ultrafractal.com/help/writing/formulas/fractalformulas.html",
  ),
  coloringAlgorithms: source(
    "Writing coloring algorithms",
    "https://www.ultrafractal.com/help/writing/formulas/coloringalgorithms.html",
  ),
  transformations: source(
    "Writing transformations",
    "https://www.ultrafractal.com/help/writing/formulas/transformations.html",
  ),
} as const;

const mergingFunctions = [
  "mergenormal",
  "mergemultiply",
  "mergescreen",
  "mergeoverlay",
  "mergehardlight",
  "mergesoftlight",
  "mergedarken",
  "mergelighten",
  "mergedifference",
  "mergehue",
  "mergesaturation",
  "mergecolor",
  "mergeluminance",
  "mergeaddition",
  "mergesubtraction",
  "mergehsladdition",
  "mergered",
  "mergegreen",
  "mergeblue",
] as const;

export const UF6_CATALOG = {
  version: ULTRA_FRACTAL_VERSION,

  primitiveTypes: group(
    ["bool", "int", "float", "complex", "color"],
    UF6_SOURCES.types,
  ),

  builtInClasses: group(
    ["Object", "Image"],
    UF6_SOURCES.builtInClasses,
  ),

  reservedKeywords: group(
    [
      "bool",
      "color",
      "complex",
      "else",
      "elseif",
      "endfunc",
      "endheading",
      "endif",
      "endparam",
      "endwhile",
      "false",
      "float",
      "func",
      "heading",
      "if",
      "int",
      "param",
      "repeat",
      "true",
      "until",
      "while",
    ],
    UF6_SOURCES.keywords,
  ),

  semiReservedKeywords: group(
    ["const", "import", "new", "return", "static", "this"],
    UF6_SOURCES.keywords,
  ),

  contextualClassWords: group(
    ["class", "public", "private", "protected"],
    UF6_SOURCES.classes,
    UF6_SOURCES.visibility,
  ),

  controlFlowKeywords: group(
    [
      "if",
      "elseif",
      "else",
      "endif",
      "while",
      "endwhile",
      "repeat",
      "until",
      "return",
    ],
    UF6_SOURCES.keywords,
  ),

  blockKeywords: group(
    [
      "if",
      "elseif",
      "else",
      "endif",
      "while",
      "endwhile",
      "repeat",
      "until",
      "func",
      "endfunc",
      "param",
      "endparam",
      "heading",
      "endheading",
    ],
    UF6_SOURCES.keywords,
  ),

  compilerDirectives: group(
    ["$define", "$undef", "$ifdef", "$else", "$endif"],
    UF6_SOURCES.directives,
  ),

  builtInFunctions: group(
    [
      "abs",
      "acos",
      "acosh",
      "alpha",
      "asin",
      "asinh",
      "atan",
      "atan2",
      "atanh",
      "blend",
      "blue",
      "cabs",
      "ceil",
      "compose",
      "conj",
      "cos",
      "cosh",
      "cotan",
      "cotanh",
      "exp",
      "flip",
      "floor",
      "gradient",
      "green",
      "hsl",
      "hsla",
      "hue",
      "ident",
      "imag",
      "isInf",
      "isNaN",
      "length",
      "log",
      "lum",
      "oldz",
      "print",
      "random",
      "real",
      "recip",
      "red",
      "rgb",
      "rgba",
      "round",
      "sat",
      "setLength",
      "sin",
      "sinh",
      "sqr",
      "sqrt",
      "tan",
      "tanh",
      "trunc",
      "zero",
      ...mergingFunctions,
    ],
    UF6_SOURCES.functions,
    UF6_SOURCES.arithmeticFunctions,
    UF6_SOURCES.trigonometricFunctions,
    UF6_SOURCES.colorFunctions,
    UF6_SOURCES.conversionFunctions,
    UF6_SOURCES.miscellaneousFunctions,
    UF6_SOURCES.mergingFunctions,
  ),

  predefinedSymbols: group(
    [
      "#angle",
      "#calculationPurpose",
      "#center",
      "#color",
      "#dpixel",
      "#dz",
      "#e",
      "#height",
      "#index",
      "#magn",
      "#maxiter",
      "#numiter",
      "#pi",
      "#pixel",
      "#random",
      "#randomrange",
      "#screenmax",
      "#screenpixel",
      "#skew",
      "#solid",
      "#stretch",
      "#whitesq",
      "#width",
      "#x",
      "#y",
      "#z",
    ],
    UF6_SOURCES.predefinedSymbols,
  ),

  settings: group(
    [
      "angle",
      "caption",
      "center",
      "default",
      "enabled",
      "enum",
      "expanded",
      "exponential",
      "helpfile",
      "helptopic",
      "hint",
      "magn",
      "max",
      "maxiter",
      "method",
      "min",
      "periodicity",
      "perturb",
      "precision",
      "rating",
      "render",
      "selectable",
      "skew",
      "stretch",
      "text",
      "title",
      "type",
      "visible",
    ],
    UF6_SOURCES.generalSettings,
    UF6_SOURCES.parameterSettings,
  ),

  sectionOrders: {
    ufm: group<SectionSpecification>(
      [
        {
          ordered: true,
          sections: [
            "global",
            "builtin",
            "init",
            "loop",
            "bailout",
            "perturbinit",
            "perturbloop",
            "default",
            "switch",
          ],
        },
      ],
      UF6_SOURCES.fractalFormulas,
    ),
    ucl: group<SectionSpecification>(
      [
        {
          ordered: true,
          sections: ["global", "init", "loop", "final", "default"],
        },
      ],
      UF6_SOURCES.coloringAlgorithms,
    ),
    uxf: group<SectionSpecification>(
      [
        {
          ordered: true,
          sections: ["global", "transform", "default"],
        },
      ],
      UF6_SOURCES.transformations,
    ),
    ulb: group<SectionSpecification>(
      [
        {
          ordered: true,
          sections: ["public", "protected", "private", "default"],
          notes:
            ".ulb files contain classes. Class visibility sections are public, protected, and private in that order; classes can also end with a default section.",
        },
      ],
      UF6_SOURCES.classes,
      UF6_SOURCES.visibility,
    ),
  },

  defaultSettingsByFileType: {
    ufm: group(
      [
        "angle",
        "center",
        "helpfile",
        "helptopic",
        "magn",
        "maxiter",
        "method",
        "periodicity",
        "perturb",
        "precision",
        "rating",
        "render",
        "skew",
        "stretch",
        "title",
      ],
      UF6_SOURCES.fractalFormulas,
    ),
    ucl: group(
      ["helpfile", "helptopic", "precision", "rating", "render", "title"],
      UF6_SOURCES.coloringAlgorithms,
    ),
    uxf: group(
      ["helpfile", "helptopic", "precision", "rating", "render", "title"],
      UF6_SOURCES.transformations,
    ),
  },
} as const;

export type Uf6Catalog = typeof UF6_CATALOG;
