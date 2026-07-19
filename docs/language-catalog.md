# UF6 language catalog

`src/catalog/uf6.ts` is the M0 source of truth for language tokens that later
grammar and analyzer milestones will consume.

## Version and provenance policy

- The catalog targets Ultra Fractal 6 and stores version `"6"` on every group.
- Every group carries one or more official reference URLs.
- Canonical spelling from the reference is preserved, even though Ultra
  Fractal identifiers and keywords are generally case-insensitive.
- Category table-of-contents pages are used for finite name inventories.
- The catalog contains factual names and relationships only; it does not copy
  reference descriptions or the bundled manual.

## Included groups

- Primitive types and built-in classes
- Reserved and semi-reserved keywords
- Contextual class/visibility words
- Control-flow and block keywords
- Compiler directives
- Built-in functions, including the separately documented merging functions
- Predefined `#` symbols
- General and parameter-block settings
- Legal formula section order for `.ufm`, `.ucl`, and `.uxf`
- Legal class section order for `.ulb`
- Settings allowed directly in each formula type's `default:` section

## Scope decisions

The official Keywords page does not classify `class`, `public`, `private`, or
`protected` as reserved or semi-reserved keywords. The catalog therefore keeps
them in `contextualClassWords` rather than altering the official keyword sets.

`.ulb` files contain class declarations. Their `public:`, `protected:`,
`private:`, and `default:` labels are represented using that documented class
order.

The source collection includes older formulas and user-defined functions whose
names may resemble built-ins. Catalog consumers must use case-insensitive
comparison and should not assume that every bare function call is built in.

## Updating the catalog

When targeting a later Ultra Fractal version, create a new versioned catalog or
an explicit extension of this one. Do not silently mutate UF6 facts. Any added
group or value must include an official source URL and a test that checks
case-insensitive uniqueness.
