from __future__ import annotations

import importlib.util
from pathlib import Path
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = (
    PROJECT_ROOT
    / "skills"
    / "develop-ultra-fractal-formulas"
    / "scripts"
    / "analyze_formula.py"
)


def load_script():
    specification = importlib.util.spec_from_file_location("analyze_formula", SCRIPT)
    assert specification is not None and specification.loader is not None
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


class AnalyzeFormulaTests(unittest.TestCase):
    def test_repository_detection_is_scoped(self) -> None:
        module = load_script()
        self.assertTrue(module.is_repository(PROJECT_ROOT))
        self.assertEqual(module.find_repository(str(PROJECT_ROOT)), PROJECT_ROOT)

    def test_wrapper_invokes_compiled_cli(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--repo",
                str(PROJECT_ROOT),
                "--skip-compile",
                "--format",
                "json",
                "test/fixtures/minimal.ufm",
            ],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"validationLevel": "structural"', result.stdout)
        self.assertIn('"compiled": false', result.stdout)

    def test_help_combines_wrapper_and_forwarded_cli_options(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--repo",
                str(PROJECT_ROOT),
                "--skip-compile",
                "--help",
            ],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        for option in [
            "--repo",
            "--skip-compile",
            "--format",
            "--imports",
            "--search-path",
            "--path-mode",
        ]:
            self.assertIn(option, result.stdout)
        self.assertIn("structural analysis only", result.stdout)


if __name__ == "__main__":
    unittest.main()
