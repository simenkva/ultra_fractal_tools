from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = (
    PROJECT_ROOT
    / "skills"
    / "develop-ultra-fractal-formulas"
    / "scripts"
    / "search_manual.py"
)


def load_script():
    specification = importlib.util.spec_from_file_location("search_manual", SCRIPT)
    assert specification is not None and specification.loader is not None
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


class SearchManualTests(unittest.TestCase):
    def test_page_search_and_context_are_bounded(self) -> None:
        module = load_script()
        pages = [
            "Introduction\nNothing relevant",
            "Parameters\nUse a parameter block\nMore details",
            "Classes\nImporting classes",
        ]
        hits = list(
            module.matching_pages(
                pages,
                "parameter block",
                "all",
                1,
                None,
            )
        )
        self.assertEqual([(page, text.splitlines()[0]) for page, text in hits], [(2, "Parameters")])
        context = module.bounded_context(
            hits[0][1],
            "parameter block",
            "all",
            0,
        )
        self.assertEqual(context, [(2, "Use a parameter block")])

    def test_phrase_mode_and_page_range(self) -> None:
        module = load_script()
        pages = ["first page", "writing coloring algorithms", "coloring only"]
        hits = list(
            module.matching_pages(
                pages,
                "writing coloring",
                "phrase",
                2,
                2,
            )
        )
        self.assertEqual([page for page, _ in hits], [2])

    def test_topic_heading_ranks_before_cross_reference(self) -> None:
        module = load_script()
        hits = [
            (10, "Previous topic\nNext: Writing coloring algorithms"),
            (12, "Writing coloring algorithms\nTopic body"),
        ]
        ranked = module.rank_page_hits(hits, "Writing coloring algorithms")
        self.assertEqual([page for page, _ in ranked], [12, 10])

    def test_manual_is_found_from_installed_script_source(self) -> None:
        module = load_script()
        with tempfile.TemporaryDirectory(prefix="uf-manual-cwd-") as directory:
            with mock.patch.dict(
                os.environ,
                {
                    module.MANUAL_ENV: "",
                    module.REPOSITORY_ENV: "",
                },
                clear=False,
            ):
                previous = Path.cwd()
                try:
                    os.chdir(directory)
                    self.assertEqual(
                        module.default_manual_path(),
                        PROJECT_ROOT / "uf6-manual.pdf",
                    )
                finally:
                    os.chdir(previous)


if __name__ == "__main__":
    unittest.main()
