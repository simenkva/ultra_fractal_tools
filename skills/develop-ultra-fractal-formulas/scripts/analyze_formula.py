#!/usr/bin/env python3
"""Locate this repository and invoke its UF6 structural analyzer CLI."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Sequence


REPOSITORY_ENV = "ULTRA_FRACTAL_TOOLS_ROOT"


def executable(name: str) -> str:
    """Resolve platform-specific executable suffixes such as npm.cmd."""
    return shutil.which(name) or name


def is_repository(path: Path) -> bool:
    """Return whether path looks like the Ultra Fractal tools repository."""
    return (
        (path / "package.json").is_file()
        and (path / "src" / "analyzer" / "index.ts").is_file()
        and (path / "src" / "catalog" / "uf6.ts").is_file()
    )


def ancestors(start: Path) -> list[Path]:
    """Return start and its parents in nearest-first order."""
    resolved = start.resolve()
    return [resolved, *resolved.parents]


def find_repository(explicit: str | None = None) -> Path | None:
    """Find the repository without scanning unrelated user directories."""
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    configured = os.environ.get(REPOSITORY_ENV)
    if configured:
        candidates.append(Path(configured))
    candidates.extend(ancestors(Path.cwd()))
    candidates.extend(ancestors(Path(__file__).resolve().parent))

    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if is_repository(resolved):
            return resolved
    return None


def compilation_needed(repository: Path) -> bool:
    """Return whether the compiled CLI is absent or older than TypeScript sources."""
    cli = repository / "out" / "cli" / "analyze.js"
    if not cli.is_file():
        return True
    cli_modified = cli.stat().st_mtime_ns
    return any(
        source.stat().st_mtime_ns > cli_modified
        for source in (repository / "src").rglob("*.ts")
    )


def build_parser() -> argparse.ArgumentParser:
    """Build the wrapper parser without hiding forwarded analyzer options."""
    parser = argparse.ArgumentParser(
        description=(
            "Run UF6 structural analysis through the ultra_fractal_tools repository. "
            "All unrecognized arguments are forwarded to uf-analyze. Combined "
            "wrapper and analyzer help is shown when the repository is available."
        ),
        add_help=False,
    )
    parser.add_argument(
        "-h",
        "--help",
        action="store_true",
        help="Show wrapper options followed by the analyzer CLI options.",
    )
    parser.add_argument(
        "--repo",
        help=f"Repository root; otherwise use ${REPOSITORY_ENV} or a nearby checkout.",
    )
    parser.add_argument(
        "--skip-compile",
        action="store_true",
        help="Do not compile even when the CLI appears absent or stale.",
    )
    return parser


def parse_arguments(
    arguments: Sequence[str],
) -> tuple[argparse.Namespace, list[str]]:
    """Parse wrapper flags and leave analyzer flags untouched."""
    parser = build_parser()
    return parser.parse_known_args(arguments)


def prepare_cli(repository: Path, skip_compile: bool) -> tuple[Path, int]:
    """Compile when needed and return the CLI path plus a status code."""
    cli = repository / "out" / "cli" / "analyze.js"
    if not skip_compile and compilation_needed(repository):
        compiled = subprocess.run(
            [executable("npm"), "run", "compile"],
            cwd=repository,
            check=False,
        )
        if compiled.returncode != 0:
            return cli, compiled.returncode

    if not cli.is_file():
        print(
            "analyze_formula: compiled CLI is missing; run npm run compile.",
            file=sys.stderr,
        )
        return cli, 2
    return cli, 0


def show_help(options: argparse.Namespace, repository: Path | None) -> int:
    """Show wrapper help and dynamically append the current analyzer help."""
    print(build_parser().format_help().rstrip(), flush=True)
    if repository is None:
        print(
            "\nAnalyzer CLI options are unavailable because the repository was "
            f"not found; pass --repo or set {REPOSITORY_ENV}."
        )
        return 0

    cli, status = prepare_cli(repository, options.skip_compile)
    if status != 0:
        return status
    print("\nAnalyzer CLI options:", flush=True)
    result = subprocess.run(
        [executable("node"), str(cli), "--help"],
        cwd=repository,
        check=False,
    )
    return result.returncode


def run(arguments: Sequence[str]) -> int:
    """Compile when needed, then invoke the analyzer with forwarded arguments."""
    options, forwarded = parse_arguments(arguments)
    repository = find_repository(options.repo)
    if options.help:
        return show_help(options, repository)
    if repository is None:
        print(
            "analyze_formula: Ultra Fractal tools repository not found; "
            f"pass --repo or set {REPOSITORY_ENV}.",
            file=sys.stderr,
        )
        return 2

    cli, status = prepare_cli(repository, options.skip_compile)
    if status != 0:
        return status

    result = subprocess.run(
        [executable("node"), str(cli), *forwarded],
        cwd=Path.cwd(),
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:]))
