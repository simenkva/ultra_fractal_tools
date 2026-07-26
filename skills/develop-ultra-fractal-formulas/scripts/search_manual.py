#!/usr/bin/env python3
"""Search a private local UF6 manual while emitting only bounded page hits."""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Iterable, Sequence


MANUAL_ENV = "ULTRA_FRACTAL_MANUAL"
CACHE_ENV = "ULTRA_FRACTAL_CACHE"
REPOSITORY_ENV = "ULTRA_FRACTAL_TOOLS_ROOT"
MAX_LINE_CHARACTERS = 240


def default_manual_path() -> Path | None:
    """Resolve only explicit or nearby manual paths."""
    configured = os.environ.get(MANUAL_ENV)
    if configured:
        return Path(configured).resolve()
    repository = os.environ.get(REPOSITORY_ENV)
    if repository:
        candidate = Path(repository).resolve() / "uf6-manual.pdf"
        if candidate.is_file():
            return candidate
    starts = [Path.cwd().resolve(), Path(__file__).resolve().parent]
    seen: set[Path] = set()
    for start in starts:
        for directory in [start, *start.parents]:
            if directory in seen:
                continue
            seen.add(directory)
            candidate = directory / "uf6-manual.pdf"
            if candidate.is_file():
                return candidate
    return None


def file_fingerprint(path: Path) -> str:
    """Return a content fingerprint without exposing the local path."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def cache_directory(explicit: str | None = None) -> Path:
    """Return a private cache outside the skill package by default."""
    configured = explicit or os.environ.get(CACHE_ENV)
    if configured:
        return Path(configured).resolve()
    return Path(tempfile.gettempdir()) / "ultra-fractal-skill-cache"


def extract_manual(
    manual: Path,
    cache_dir: Path,
    pdftotext: str = "pdftotext",
) -> tuple[Path, str]:
    """Extract the manual once and cache it under a content fingerprint."""
    executable = shutil.which(pdftotext)
    if executable is None:
        raise RuntimeError(
            f"'{pdftotext}' was not found; install Poppler or pass --pdftotext."
        )
    fingerprint = file_fingerprint(manual)
    cache_dir.mkdir(parents=True, exist_ok=True)
    try:
        cache_dir.chmod(0o700)
    except OSError:
        pass
    extracted = cache_dir / f"uf6-manual-{fingerprint}.txt"
    if not extracted.is_file():
        temporary = cache_dir / f".{extracted.name}.{os.getpid()}.tmp"
        result = subprocess.run(
            [executable, "-layout", str(manual), str(temporary)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            temporary.unlink(missing_ok=True)
            detail = result.stderr.strip() or "unknown pdftotext failure"
            raise RuntimeError(f"Could not extract the UF6 manual: {detail}")
        temporary.chmod(0o600)
        temporary.replace(extracted)
    return extracted, fingerprint


def matching_pages(
    pages: Sequence[str],
    query: str,
    mode: str,
    page_start: int,
    page_end: int | None,
) -> Iterable[tuple[int, str]]:
    """Yield pages matching the query in PDF page order."""
    terms = [term.casefold() for term in re.findall(r"\S+", query) if term]
    phrase = query.casefold().strip()
    if not terms:
        return
    last = len(pages) if page_end is None else min(len(pages), page_end)
    for page_number in range(max(1, page_start), last + 1):
        page = pages[page_number - 1]
        folded = page.casefold()
        matched = phrase in folded if mode == "phrase" else all(
            term in folded for term in terms
        )
        if matched:
            yield page_number, page


def rank_page_hits(
    hits: Iterable[tuple[int, str]],
    query: str,
) -> list[tuple[int, str]]:
    """Rank direct topic pages before incidental cross-references."""
    phrase = " ".join(query.casefold().split())

    def score(item: tuple[int, str]) -> tuple[int, int]:
        page_number, page = item
        normalized_lines = [
            " ".join(line.casefold().split()) for line in page.splitlines()
        ]
        exact_heading = any(line == phrase for line in normalized_lines)
        heading_prefix = any(line.startswith(phrase) for line in normalized_lines)
        phrase_count = " ".join(page.casefold().split()).count(phrase)
        relevance = (
            (100 if exact_heading else 0)
            + (50 if heading_prefix else 0)
            + min(phrase_count, 10)
        )
        return (-relevance, page_number)

    return sorted(hits, key=score)


def bounded_context(
    page: str,
    query: str,
    mode: str,
    context_lines: int,
) -> list[tuple[int, str]]:
    """Return a bounded line window around the first page match."""
    lines = page.splitlines()
    terms = [term.casefold() for term in re.findall(r"\S+", query) if term]
    phrase = query.casefold().strip()
    match_index = 0
    predicates = (
        [lambda folded: phrase in folded]
        if mode == "phrase"
        else [
            lambda folded: phrase in folded,
            lambda folded: all(term in folded for term in terms),
            lambda folded: any(term in folded for term in terms),
        ]
    )
    for predicate in predicates:
        matched_index = next(
            (
                index
                for index, line in enumerate(lines)
                if predicate(line.casefold())
            ),
            None,
        )
        if matched_index is not None:
            match_index = matched_index
            break
    start = max(0, match_index - context_lines)
    end = min(len(lines), match_index + context_lines + 1)
    return [
        (index + 1, lines[index][:MAX_LINE_CHARACTERS].rstrip())
        for index in range(start, end)
        if lines[index].strip()
    ]


def parse_arguments(arguments: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Search a private local UF6 manual and print bounded hits. "
            "The extracted cache is never stored in the skill package."
        )
    )
    parser.add_argument("query", help="Words or phrase to find")
    parser.add_argument("--manual", help=f"Manual path; defaults to ${MANUAL_ENV}")
    parser.add_argument("--cache-dir", help=f"Private cache; defaults to ${CACHE_ENV}")
    parser.add_argument("--pdftotext", default="pdftotext")
    parser.add_argument("--mode", choices=["all", "phrase"], default="all")
    parser.add_argument("--max-results", type=int, default=5)
    parser.add_argument("--context-lines", type=int, default=1)
    parser.add_argument("--page-start", type=int, default=1)
    parser.add_argument("--page-end", type=int)
    options = parser.parse_args(arguments)
    if options.max_results < 1 or options.max_results > 20:
        parser.error("--max-results must be between 1 and 20")
    if options.context_lines < 0 or options.context_lines > 4:
        parser.error("--context-lines must be between 0 and 4")
    if options.page_start < 1:
        parser.error("--page-start must be positive")
    if options.page_end is not None and options.page_end < options.page_start:
        parser.error("--page-end must not precede --page-start")
    return options


def run(arguments: Sequence[str]) -> int:
    options = parse_arguments(arguments)
    manual = (
        Path(options.manual).resolve()
        if options.manual
        else default_manual_path()
    )
    if manual is None or not manual.is_file():
        print(
            "search_manual: private UF6 manual not found; pass --manual or set "
            f"{MANUAL_ENV}.",
            file=sys.stderr,
        )
        return 2
    try:
        extracted, fingerprint = extract_manual(
            manual,
            cache_directory(options.cache_dir),
            options.pdftotext,
        )
        pages = extracted.read_text(encoding="utf8").split("\f")
    except (OSError, RuntimeError, UnicodeError) as error:
        print(f"search_manual: {error}", file=sys.stderr)
        return 2

    hits = rank_page_hits(
        matching_pages(
            pages,
            options.query,
            options.mode,
            options.page_start,
            options.page_end,
        ),
        options.query,
    )[: options.max_results]
    print(
        "Source: private local Ultra Fractal 6 manual "
        f"(fingerprint {fingerprint[:12]}; not bundled)."
    )
    print(
        "Limit: the PDF introduction says the compiler reference is excluded; "
        "use official UF6 help pages for complete built-in semantics."
    )
    if not hits:
        print("No matching pages.")
        return 1
    for page_number, page in hits:
        print(f"\nPDF page {page_number}")
        for line_number, line in bounded_context(
            page,
            options.query,
            options.mode,
            options.context_lines,
        ):
            print(f"  {line_number}: {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:]))
