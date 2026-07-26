# Legacy Syntax, Classes, Imports, and Plug-ins

## Handle legacy syntax

Accept compatibility forms that the repository documents, including
case-insensitive language words, omitted initial sections, the empty `.ufm`
loop label, predefined parameter/function aliases, optional parameter blocks,
semi-reserved words used as old identifiers, and historical line endings or
encodings.

Procedure:

1. Identify the construct and cite `docs/legacy-syntax.md` or official UF6
   documentation.
2. Explain its effective meaning before discussing style.
3. Preserve it when the user only requests explanation or debugging.
4. Offer an explicit modernization separately.
5. Preserve entry identifiers, parameter names, defaults, and behavior.
6. Identify whether the legacy behavior is mathematically intentional,
   visually intentional, or unresolved before “correcting” it.
7. Validate structurally, compile in UF6, and compare renders before claiming
   equivalence.

Do not treat corpus frequency as language legality. Do not modernize a
compiler-conditional or compatibility layout without understanding its
supported versions.

## Work with classes and imports

1. Obtain the complete class declaration and explicit import roots.
2. Verify the import filename and class name independently.
3. Inspect public, protected, private, and default sections in documented
   order.
4. Identify constructors, fields, methods, static members, inheritance, and
   overridden methods from actual source.
5. Resolve member behavior from the class source or official built-in class
   documentation.
6. Treat an absent import as missing only when every UF search location is
   known and checked.
7. Analyze all related files together when the task changes a class and its
   consumers.
8. Require UF6 compilation for inheritance compatibility, visibility, method
   signatures, and overload resolution.

Do not assume that a corpus class with a familiar name is the user's imported
class. Do not invent members from naming conventions.

## Design plug-ins

- Start from the required base class and contract documented for the intended
  plug-in category.
- Keep the public interface small and stable.
- Put internal state behind private fields and focused methods.
- Expose only useful plug-in parameters with safe defaults and helpful hints.
- Make ownership and lifecycle assumptions explicit.
- Review per-pixel object creation and memory use.
- Verify construction, overrides, parameter forwarding, and imports in UF6.

If the official contract or base-class member list is unavailable, stop before
writing an implementation that depends on guessed methods. Ask for the
relevant class source, official help page, or compiler feedback.

## Unknown class protocol

Report:

```text
Class/member: <name>
Catalog/manual status: found | not found
Import source inspected: yes | no
Corpus observation: optional and non-authoritative
Conclusion: verified | unresolved
Needed next: source, official documentation, or UF6 compiler message
```
