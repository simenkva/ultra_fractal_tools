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
    / "find_corpus_examples.py"
)


def load_script():
    specification = importlib.util.spec_from_file_location(
        "find_corpus_examples", SCRIPT
    )
    assert specification is not None and specification.loader is not None
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


class FindCorpusExamplesTests(unittest.TestCase):
    def test_candidates_filter_by_type_feature_and_query(self) -> None:
        module = load_script()
        with tempfile.TemporaryDirectory(prefix="uf-corpus-test-") as directory:
            root = Path(directory)
            (root / "example.ucl").write_text(
                "Example(OUTSIDE) {\nfinal:\n  #color = rgb(1, 0, 0)\n"
                "default:\n  float param scale\n  endparam\n}\n",
                encoding="latin1",
            )
            (root / "other.ufm").write_text(
                "Other {\ninit:\n  z = #pixel\n}\n",
                encoding="latin1",
            )
            candidates = module.discover_candidates(
                root,
                "ucl",
                ["direct-coloring", "parameters"],
                "rgb",
            )
            self.assertEqual(
                [candidate.relative_path for candidate in candidates],
                ["example.ucl"],
            )
            self.assertEqual(candidates[0].query_hits, 1)
            self.assertIn("direct-coloring", candidates[0].features)

    def test_excerpt_is_tightly_bounded(self) -> None:
        module = load_script()
        with tempfile.TemporaryDirectory(prefix="uf-corpus-test-") as directory:
            root = Path(directory)
            source = "line one\nline two\nimport \"common.ulb\"\nline four\nline five\n"
            file_path = root / "example.ulb"
            file_path.write_text(source, encoding="latin1")
            candidate = module.discover_candidates(
                root,
                "ulb",
                ["imports"],
                None,
            )[0]
            excerpt = list(module.excerpt(candidate, 1))
            self.assertEqual([line for line, _ in excerpt], [2, 3, 4])

    def test_legacy_line_endings_are_normalized_for_features(self) -> None:
        module = load_script()
        source = 'Example {\rglobal:\r  import "common.ulb"\r}\r'
        normalized = module.normalize_line_endings(source)
        self.assertIn("imports", module.feature_names(normalized))
        self.assertEqual(module.first_matching_line(normalized, None, ["imports"]), 3)
        self.assertEqual(module.count_lines(normalized), 5)
        self.assertEqual(module.count_lines(""), 1)

    def test_corpus_is_found_from_installed_script_source(self) -> None:
        module = load_script()
        with tempfile.TemporaryDirectory(prefix="uf-corpus-cwd-") as directory:
            with mock.patch.dict(
                os.environ,
                {
                    module.CORPUS_ENV: "",
                    module.REPOSITORY_ENV: "",
                },
                clear=False,
            ):
                previous = Path.cwd()
                try:
                    os.chdir(directory)
                    self.assertEqual(
                        module.default_corpus_path(),
                        PROJECT_ROOT / "uf-formulas",
                    )
                finally:
                    os.chdir(previous)


if __name__ == "__main__":
    unittest.main()
