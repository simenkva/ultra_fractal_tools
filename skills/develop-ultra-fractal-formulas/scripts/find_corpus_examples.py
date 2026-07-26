#!/usr/bin/env python3
"""Rank a few private corpus files by UF feature without copying their source."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import math
import os
from pathlib import Path
import re
import sys
from typing import Iterable, Sequence


CORPUS_ENV = "ULTRA_FRACTAL_CORPUS"
REPOSITORY_ENV = "ULTRA_FRACTAL_TOOLS_ROOT"
SUPPORTED_TYPES = {"ufm", "ucl", "uxf", "ulb"}
MAX_EXCERPT_CHARACTERS = 200

FEATURE_PATTERNS: dict[str, re.Pattern[str]] = {
    "parameters": re.compile(r"(?im)^\s*(?:\w+\s+)?param\s+@?\w+"),
    "functions": re.compile(r"(?im)^\s*(?:\w+\s+)?func\s+@?\w+"),
    "imports": re.compile(r'(?im)^\s*import\s+"[^"\r\n]+"'),
    "classes": re.compile(r"(?im)^\s*class\s+\S+"),
    "direct-coloring": re.compile(r"(?im)^\s*#color\s*="),
    "perturbation": re.compile(r"(?im)^\s*perturb(?:init|loop)\s*:"),
    "legacy-label": re.compile(r"(?m)^\s*:\s*(?:;.*)?$"),
    "switch": re.compile(r"(?im)^\s*switch\s*:"),
    "arrays": re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*\s*\[[^\]\r\n]*\]"),
}


@dataclass(frozen=True)
class Candidate:
    path: Path
    relative_path: str
    file_type: str
    bytes: int
    lines: int
    features: tuple[str, ...]
    query_hits: int
    first_match_line: int | None
    score: float


def default_corpus_path() -> Path | None:
    """Resolve only explicit or nearby corpus directories."""
    configured = os.environ.get(CORPUS_ENV)
    if configured:
        return Path(configured).resolve()
    repository = os.environ.get(REPOSITORY_ENV)
    if repository:
        candidate = Path(repository).resolve() / "uf-formulas"
        if candidate.is_dir():
            return candidate
    starts = [Path.cwd().resolve(), Path(__file__).resolve().parent]
    seen: set[Path] = set()
    for start in starts:
        for directory in [start, *start.parents]:
            if directory in seen:
                continue
            seen.add(directory)
            candidate = directory / "uf-formulas"
            if candidate.is_dir():
                return candidate
    return None


def feature_names(source: str) -> tuple[str, ...]:
    """Return feature labels in stable declaration order."""
    return tuple(
        name for name, pattern in FEATURE_PATTERNS.items() if pattern.search(source)
    )


def normalize_line_endings(source: str) -> str:
    """Normalize legacy CR and CRLF for line-oriented feature matching."""
    return source.replace("\r\n", "\n").replace("\r", "\n")


def count_lines(source: str) -> int:
    """Count physical lines, including the single line in an empty file."""
    return 1 if source == "" else source.count("\n") + 1


def first_matching_line(
    source: str,
    query: str | None,
    requested_features: Sequence[str],
) -> int | None:
    """Return the one-based line containing the first relevant match."""
    offsets: list[int] = []
    if query:
        query_index = source.casefold().find(query.casefold())
        if query_index >= 0:
            offsets.append(query_index)
    for feature in requested_features:
        match = FEATURE_PATTERNS[feature].search(source)
        if match is not None:
            offsets.append(match.start())
    if not offsets:
        return None
    return source.count("\n", 0, min(offsets)) + 1


def discover_candidates(
    corpus: Path,
    file_type: str | None,
    requested_features: Sequence[str],
    query: str | None,
) -> list[Candidate]:
    """Scan supported files and return deterministic ranked candidates."""
    candidates: list[Candidate] = []
    query_folded = query.casefold() if query else None
    for file_path in sorted(path for path in corpus.rglob("*") if path.is_file()):
        extension = file_path.suffix.lower().lstrip(".")
        if extension not in SUPPORTED_TYPES:
            continue
        if file_type and extension != file_type:
            continue
        try:
            data = file_path.read_bytes()
        except OSError:
            continue
        source = normalize_line_endings(data.decode("latin1"))
        features = feature_names(source)
        if any(feature not in features for feature in requested_features):
            continue
        query_hits = (
            source.casefold().count(query_folded)
            if query_folded is not None
            else 0
        )
        if query_folded is not None and query_hits == 0:
            continue
        feature_score = 10 * len(requested_features)
        query_score = min(query_hits, 20) * 2
        size_penalty = math.log10(max(10, len(data)))
        relative = file_path.relative_to(corpus).as_posix()
        candidates.append(
            Candidate(
                path=file_path,
                relative_path=relative,
                file_type=extension,
                bytes=len(data),
                lines=count_lines(source),
                features=features,
                query_hits=query_hits,
                first_match_line=first_matching_line(
                    source, query, requested_features
                ),
                score=feature_score + query_score - size_penalty,
            )
        )
    return sorted(
        candidates,
        key=lambda candidate: (-candidate.score, candidate.relative_path),
    )


def excerpt(candidate: Candidate, context_lines: int) -> Iterable[tuple[int, str]]:
    """Yield a tightly bounded local excerpt around the ranked match."""
    if candidate.first_match_line is None:
        return
    source_lines = candidate.path.read_bytes().decode("latin1").splitlines()
    index = candidate.first_match_line - 1
    start = max(0, index - context_lines)
    end = min(len(source_lines), index + context_lines + 1)
    for line_index in range(start, end):
        yield (
            line_index + 1,
            source_lines[line_index][:MAX_EXCERPT_CHARACTERS].rstrip(),
        )


def parse_arguments(arguments: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Rank a small number of private local Ultra Fractal corpus files. "
            "Metadata-only output is the default."
        )
    )
    parser.add_argument("--corpus", help=f"Corpus root; defaults to ${CORPUS_ENV}")
    parser.add_argument("--type", choices=sorted(SUPPORTED_TYPES))
    parser.add_argument(
        "--feature",
        action="append",
        choices=sorted(FEATURE_PATTERNS),
        default=[],
        help="Required structural feature; repeat for multiple features",
    )
    parser.add_argument("--query", help="Case-insensitive source search term")
    parser.add_argument("--limit", type=int, default=3)
    parser.add_argument(
        "--excerpt",
        action="store_true",
        help="Show a bounded local excerpt for inspection; never copy it into output code",
    )
    parser.add_argument("--context-lines", type=int, default=1)
    options = parser.parse_args(arguments)
    if options.limit < 1 or options.limit > 10:
        parser.error("--limit must be between 1 and 10")
    if options.context_lines < 0 or options.context_lines > 2:
        parser.error("--context-lines must be between 0 and 2")
    if not options.feature and not options.query:
        parser.error("provide at least one --feature or --query")
    return options


def run(arguments: Sequence[str]) -> int:
    options = parse_arguments(arguments)
    corpus = (
        Path(options.corpus).resolve()
        if options.corpus
        else default_corpus_path()
    )
    if corpus is None or not corpus.is_dir():
        print(
            "find_corpus_examples: private corpus not found; pass --corpus or "
            f"set {CORPUS_ENV}.",
            file=sys.stderr,
        )
        return 2

    candidates = discover_candidates(
        corpus,
        options.type,
        options.feature,
        options.query,
    )[: options.limit]
    print(
        "Source: private local community corpus (not bundled). "
        "Observed usage is not proof of correctness."
    )
    print(
        "Use candidates as evidence of idioms only; write an original implementation "
        "from the requested behavior."
    )
    if not candidates:
        print("No matching files.")
        return 1
    for candidate in candidates:
        feature_text = ",".join(candidate.features) or "none"
        print(
            f"\n{candidate.relative_path} type={candidate.file_type} "
            f"bytes={candidate.bytes} lines={candidate.lines} "
            f"features={feature_text} query_hits={candidate.query_hits}"
        )
        if options.excerpt:
            print("  Local inspection excerpt (do not reproduce):")
            for line_number, line in excerpt(
                candidate, options.context_lines
            ):
                print(f"    {line_number}: {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:]))
