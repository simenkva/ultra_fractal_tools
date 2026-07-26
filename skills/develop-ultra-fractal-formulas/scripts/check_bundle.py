#!/usr/bin/env python3
"""Analyze related UF6 files and report separate project-level advisories."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any, Sequence


sys.dont_write_bytecode = True
SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import analyze_formula  # noqa: E402


ROLE_EXTENSIONS = {
    "fractal": ".ufm",
    "coloring": ".ucl",
    "transformation": ".uxf",
    "library": ".ulb",
}
DEFINITION_KINDS = {"entry", "class"}


@dataclass(frozen=True)
class ExpectedDefinition:
    name: str
    kind: str


@dataclass(frozen=True)
class ManifestFile:
    path: Path
    role: str
    expected_definitions: tuple[ExpectedDefinition, ...]


@dataclass(frozen=True)
class BundleManifest:
    path: Path
    files: tuple[ManifestFile, ...]
    unique_definition_identifiers: bool


@dataclass(frozen=True)
class BundleAdvisory:
    rule: str
    severity: str
    message: str
    path: str | None = None
    line: int | None = None
    column: int | None = None


def require_object(value: Any, description: str) -> dict[str, Any]:
    """Return a JSON object or raise a focused manifest error."""
    if not isinstance(value, dict):
        raise ValueError(f"{description} must be a JSON object.")
    return value


def require_string(value: Any, description: str) -> str:
    """Return a non-empty string or raise a focused manifest error."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{description} must be a non-empty string.")
    return value


def load_manifest(path: Path) -> BundleManifest:
    """Load and validate the small bundle-manifest schema."""
    try:
        data = require_object(
            json.loads(path.read_text(encoding="utf8")),
            "Bundle manifest",
        )
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read bundle manifest: {error}") from error

    if data.get("schemaVersion") != 1:
        raise ValueError("Bundle manifest schemaVersion must be 1.")
    if data.get("target") != "UF6":
        raise ValueError("Bundle manifest target must be 'UF6'.")

    raw_files = data.get("files")
    if not isinstance(raw_files, list) or not raw_files:
        raise ValueError("Bundle manifest files must be a non-empty array.")

    manifest_files: list[ManifestFile] = []
    for index, raw_file in enumerate(raw_files):
        item = require_object(raw_file, f"files[{index}]")
        relative_path = require_string(item.get("path"), f"files[{index}].path")
        role = require_string(item.get("role"), f"files[{index}].role")
        if role not in ROLE_EXTENSIONS:
            expected = ", ".join(sorted(ROLE_EXTENSIONS))
            raise ValueError(
                f"files[{index}].role must be one of {expected}."
            )

        raw_definitions = item.get("expectedDefinitions", [])
        if not isinstance(raw_definitions, list):
            raise ValueError(
                f"files[{index}].expectedDefinitions must be an array."
            )
        expected_definitions: list[ExpectedDefinition] = []
        for definition_index, raw_definition in enumerate(raw_definitions):
            definition = require_object(
                raw_definition,
                f"files[{index}].expectedDefinitions[{definition_index}]",
            )
            name = require_string(
                definition.get("name"),
                f"files[{index}].expectedDefinitions[{definition_index}].name",
            )
            kind = require_string(
                definition.get("kind"),
                f"files[{index}].expectedDefinitions[{definition_index}].kind",
            )
            if kind not in DEFINITION_KINDS:
                raise ValueError(
                    f"files[{index}].expectedDefinitions[{definition_index}].kind "
                    "must be 'entry' or 'class'."
                )
            expected_definitions.append(ExpectedDefinition(name, kind))

        manifest_files.append(
            ManifestFile(
                path=(path.parent / relative_path).resolve(),
                role=role,
                expected_definitions=tuple(expected_definitions),
            )
        )

    conventions = require_object(
        data.get("conventions", {}),
        "Bundle manifest conventions",
    )
    unique = conventions.get("uniqueDefinitionIdentifiers", False)
    if not isinstance(unique, bool):
        raise ValueError(
            "conventions.uniqueDefinitionIdentifiers must be true or false."
        )

    return BundleManifest(
        path=path.resolve(),
        files=tuple(manifest_files),
        unique_definition_identifiers=unique,
    )


def unique_paths(paths: Sequence[Path]) -> list[Path]:
    """Return resolved paths in first-seen order."""
    result: list[Path] = []
    seen: set[Path] = set()
    for path in paths:
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            result.append(resolved)
    return result


def definition_location(definition: dict[str, Any]) -> tuple[int | None, int | None]:
    """Convert an analyzer name range to a one-based location."""
    start = definition.get("nameRange", {}).get("start", {})
    line = start.get("line")
    column = start.get("character")
    return (
        line + 1 if isinstance(line, int) else None,
        column + 1 if isinstance(column, int) else None,
    )


def build_advisories(
    report: dict[str, Any],
    requested_paths: Sequence[Path],
    manifest: BundleManifest | None,
) -> list[BundleAdvisory]:
    """Build project advisories without changing analyzer UF diagnostics."""
    file_reports = report.get("files", [])
    if not isinstance(file_reports, list) or len(file_reports) != len(requested_paths):
        raise ValueError("Analyzer report did not preserve the requested file list.")

    manifest_by_path = (
        {item.path: item for item in manifest.files}
        if manifest is not None
        else {}
    )
    advisories: list[BundleAdvisory] = []
    definitions_by_name: dict[
        str, list[tuple[str, dict[str, Any]]]
    ] = {}

    for requested_path, file_report_value in zip(requested_paths, file_reports):
        file_report = require_object(file_report_value, "Analyzer file report")
        display_path = str(file_report.get("path", requested_path.name))
        definitions = file_report.get("definitions", [])
        if not isinstance(definitions, list):
            raise ValueError("Analyzer file definitions must be an array.")

        manifest_file = manifest_by_path.get(requested_path)
        if manifest_file is not None:
            expected_extension = ROLE_EXTENSIONS[manifest_file.role]
            if requested_path.suffix.casefold() != expected_extension:
                advisories.append(
                    BundleAdvisory(
                        rule="UFB1001",
                        severity="warning",
                        path=display_path,
                        message=(
                            f"Manifest role '{manifest_file.role}' expects "
                            f"'{expected_extension}', but this file uses "
                            f"'{requested_path.suffix or '<none>'}'."
                        ),
                    )
                )

            actual_by_name = {
                str(definition.get("name", "")).casefold(): definition
                for definition in definitions
                if isinstance(definition, dict)
            }
            for expected in manifest_file.expected_definitions:
                actual = actual_by_name.get(expected.name.casefold())
                if actual is None:
                    advisories.append(
                        BundleAdvisory(
                            rule="UFB1002",
                            severity="warning",
                            path=display_path,
                            message=(
                                f"Expected {expected.kind} definition "
                                f"'{expected.name}' was not found."
                            ),
                        )
                    )
                    continue
                actual_kind = actual.get("kind")
                if actual_kind != expected.kind:
                    line, column = definition_location(actual)
                    advisories.append(
                        BundleAdvisory(
                            rule="UFB1003",
                            severity="warning",
                            path=display_path,
                            line=line,
                            column=column,
                            message=(
                                f"Definition '{expected.name}' is a "
                                f"'{actual_kind}', but the manifest expects "
                                f"'{expected.kind}'."
                            ),
                        )
                    )

        for definition in definitions:
            if not isinstance(definition, dict):
                continue
            name = definition.get("name")
            if not isinstance(name, str) or not name:
                continue
            definitions_by_name.setdefault(name.casefold(), []).append(
                (display_path, definition)
            )

    unique_required = (
        manifest.unique_definition_identifiers
        if manifest is not None
        else False
    )
    for occurrences in definitions_by_name.values():
        paths = {path for path, _ in occurrences}
        if len(paths) < 2:
            continue
        first_path, first_definition = occurrences[0]
        name = str(first_definition.get("name"))
        line, column = definition_location(first_definition)
        advisories.append(
            BundleAdvisory(
                rule="UFB2001",
                severity="warning" if unique_required else "information",
                path=first_path,
                line=line,
                column=column,
                message=(
                    f"Definition identifier '{name}' occurs in multiple files: "
                    f"{', '.join(sorted(paths))}. "
                    + (
                        "The bundle manifest requires unique identifiers."
                        if unique_required
                        else "Cross-file reuse may be intentional and is not a UF6 error."
                    )
                ),
            )
        )

    return advisories


def format_text(report: dict[str, Any]) -> str:
    """Format structural diagnostics and bundle advisories for humans."""
    lines: list[str] = []
    structural = require_object(report.get("structural"), "Structural report")
    for file_report_value in structural.get("files", []):
        file_report = require_object(file_report_value, "Analyzer file report")
        display_path = str(file_report.get("path", "<unknown>"))
        diagnostics = file_report.get("diagnostics", [])
        if not diagnostics:
            lines.append(f"{display_path}: structurally clean for UF6.")
            continue
        for diagnostic_value in diagnostics:
            diagnostic = require_object(diagnostic_value, "Analyzer diagnostic")
            start = diagnostic.get("range", {}).get("start", {})
            line = int(start.get("line", 0)) + 1
            column = int(start.get("character", 0)) + 1
            lines.append(
                f"{display_path}:{line}:{column}: "
                f"{diagnostic.get('severity')} {diagnostic.get('rule')}: "
                f"{diagnostic.get('message')}"
            )

    for advisory_value in report.get("advisories", []):
        advisory = require_object(advisory_value, "Bundle advisory")
        location = str(advisory.get("path") or "<bundle>")
        if advisory.get("line") is not None:
            location += f":{advisory['line']}:{advisory.get('column') or 1}"
        lines.append(
            f"{location}: {advisory.get('severity')} "
            f"{advisory.get('rule')}: {advisory.get('message')}"
        )

    summary = require_object(report.get("summary"), "Bundle summary")
    lines.append(
        "Bundle summary: "
        f"{summary.get('files')} file(s), "
        f"{summary.get('structuralErrors')} structural error(s), "
        f"{summary.get('structuralWarnings')} structural warning(s), "
        f"{summary.get('bundleAdvisories')} bundle advisory/advisories. "
        "UF6 compilation and rendering not tested."
    )
    return "\n".join(lines) + "\n"


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser."""
    parser = argparse.ArgumentParser(
        description=(
            "Analyze related UF6 files and report project conventions with "
            "separate UFB advisory identifiers. This does not compile or render."
        )
    )
    parser.add_argument("files", nargs="*", help="Related UF source files")
    parser.add_argument("--manifest", help="Optional UTF-8 JSON bundle manifest")
    parser.add_argument("--repo", help="Ultra Fractal tools repository root")
    parser.add_argument("--skip-compile", action="store_true")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--encoding", choices=["utf8", "latin1"], default="utf8")
    parser.add_argument(
        "--imports",
        choices=["unchecked", "exhaustive"],
        default="unchecked",
    )
    parser.add_argument("--search-path", action="append", default=[])
    parser.add_argument(
        "--disable",
        action="append",
        default=[],
        help="Disable a structural UF diagnostic; repeat as needed",
    )
    parser.add_argument("--timeout-ms", type=int, default=120000)
    parser.add_argument(
        "--path-mode",
        choices=["relative", "basename"],
        default="relative",
    )
    parser.add_argument("--fail-on-warning", action="store_true")
    parser.add_argument(
        "--fail-on-advisory",
        action="store_true",
        help="Return exit code 1 when a warning-level UFB advisory is present",
    )
    return parser


def run(arguments: Sequence[str]) -> int:
    """Run structural analysis and append deterministic bundle advisories."""
    options = build_parser().parse_args(arguments)
    try:
        manifest = (
            load_manifest(Path(options.manifest).resolve())
            if options.manifest
            else None
        )
    except ValueError as error:
        print(f"check_bundle: {error}", file=sys.stderr)
        return 2

    manifest_paths = [item.path for item in manifest.files] if manifest else []
    requested_paths = unique_paths(
        [*manifest_paths, *(Path(value) for value in options.files)]
    )
    if not requested_paths:
        print(
            "check_bundle: provide at least one file or a manifest.",
            file=sys.stderr,
        )
        return 2

    repository = analyze_formula.find_repository(options.repo)
    if repository is None:
        print(
            "check_bundle: Ultra Fractal tools repository not found; pass "
            f"--repo or set {analyze_formula.REPOSITORY_ENV}.",
            file=sys.stderr,
        )
        return 2

    cli = repository / "out" / "cli" / "analyze.js"
    if (
        not options.skip_compile
        and analyze_formula.compilation_needed(repository)
    ):
        compiled = subprocess.run(
            [analyze_formula.executable("npm"), "run", "compile"],
            cwd=repository,
            stdout=sys.stderr,
            stderr=sys.stderr,
            check=False,
        )
        if compiled.returncode != 0:
            return compiled.returncode
    if not cli.is_file():
        print(
            "check_bundle: compiled analyzer is missing; run npm run compile.",
            file=sys.stderr,
        )
        return 2

    analyzer_arguments = [
        "--format",
        "json",
        "--encoding",
        options.encoding,
        "--imports",
        options.imports,
        "--timeout-ms",
        str(options.timeout_ms),
        "--path-mode",
        options.path_mode,
    ]
    for search_path in options.search_path:
        analyzer_arguments.extend(["--search-path", search_path])
    for rule in options.disable:
        analyzer_arguments.extend(["--disable", rule])
    if options.fail_on_warning:
        analyzer_arguments.append("--fail-on-warning")
    analyzer_arguments.extend(str(path) for path in requested_paths)

    analyzed = subprocess.run(
        [
            analyze_formula.executable("node"),
            str(cli),
            *analyzer_arguments,
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        check=False,
    )
    if analyzed.returncode not in {0, 1}:
        sys.stderr.write(analyzed.stderr)
        return analyzed.returncode
    try:
        structural = require_object(
            json.loads(analyzed.stdout),
            "Analyzer report",
        )
        advisories = build_advisories(
            structural,
            requested_paths,
            manifest,
        )
    except (json.JSONDecodeError, ValueError) as error:
        print(f"check_bundle: {error}", file=sys.stderr)
        return 2

    structural_summary = require_object(
        structural.get("summary"),
        "Analyzer summary",
    )
    bundle_report = {
        "schemaVersion": 1,
        "target": "UF6",
        "validationLevel": "bundle-structural",
        "compiled": False,
        "rendered": False,
        "manifest": (
            {
                "used": True,
                "path": (
                    manifest.path.name
                    if options.path_mode == "basename"
                    else os.path.relpath(manifest.path, Path.cwd())
                ),
                "uniqueDefinitionIdentifiers": (
                    manifest.unique_definition_identifiers
                ),
            }
            if manifest is not None
            else {"used": False}
        ),
        "structural": structural,
        "advisories": [asdict(advisory) for advisory in advisories],
        "summary": {
            "files": structural_summary.get("files", 0),
            "structuralErrors": structural_summary.get("errors", 0),
            "structuralWarnings": structural_summary.get("warnings", 0),
            "bundleAdvisories": len(advisories),
            "bundleWarnings": sum(
                advisory.severity == "warning" for advisory in advisories
            ),
        },
    }
    if options.format == "json":
        print(json.dumps(bundle_report, indent=2))
    else:
        sys.stdout.write(format_text(bundle_report))

    warning_advisory = any(
        advisory.severity == "warning" for advisory in advisories
    )
    if analyzed.returncode == 1:
        return 1
    if options.fail_on_advisory and warning_advisory:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:]))
