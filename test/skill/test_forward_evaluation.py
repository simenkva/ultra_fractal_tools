from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CLI = PROJECT_ROOT / "out" / "cli" / "analyze.js"
CASES = PROJECT_ROOT / "test" / "skill" / "forward_cases.json"
CATALOG = PROJECT_ROOT / "src" / "catalog" / "uf6.ts"
SKILL = (
    PROJECT_ROOT
    / "skills"
    / "develop-ultra-fractal-formulas"
    / "SKILL.md"
)


def analyze(relative_path: str, *extra: str):
    result = subprocess.run(
        [
            "node",
            str(CLI),
            "--format",
            "json",
            *extra,
            relative_path,
        ],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    report = json.loads(result.stdout) if result.stdout else None
    return result, report


class ForwardEvaluationTests(unittest.TestCase):
    def test_case_matrix_covers_every_required_scenario(self) -> None:
        matrix = json.loads(CASES.read_text(encoding="utf8"))
        self.assertEqual(matrix["target"], "UF6")
        self.assertEqual(matrix["schemaVersion"], 2)
        identifiers = {case["id"] for case in matrix["cases"]}
        self.assertEqual(
            identifiers,
            {
                "create-parameterized-family",
                "create-outside-coloring",
                "creative-exploration",
                "faithful-algorithm-validation",
                "hybrid-design",
                "fast-path-small-formula",
                "add-parameter",
                "prose-only-validation-cadence",
                "executable-validation-cadence",
                "related-file-bundle",
                "wrapper-help-discovery",
                "diagnose-malformed",
                "compiler-error",
                "manual-native-validation",
                "explain-legacy",
                "structural-only-refusal",
                "unknown-class",
            },
        )
        self.assertTrue(
            all(len(case["success"]) >= 3 for case in matrix["cases"])
        )

    def test_original_creation_fixtures_are_structurally_clean(self) -> None:
        for relative_path in [
            "test/skill/forward/parameterized-power-family.ufm",
            "test/skill/forward/iteration-bands.ucl",
        ]:
            result, report = analyze(relative_path)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(report["summary"]["errors"], 0)
            self.assertEqual(report["summary"]["warnings"], 0)
            self.assertFalse(report["compiled"])
            self.assertFalse(report["rendered"])

    def test_creation_fixtures_use_catalogued_predefined_symbols(self) -> None:
        catalog = CATALOG.read_text(encoding="utf8")
        catalogued = set(re.findall(r'"(#[A-Za-z_][A-Za-z0-9_]*)"', catalog))
        for file_name in [
            "parameterized-power-family.ufm",
            "iteration-bands.ucl",
        ]:
            source = (
                PROJECT_ROOT / "test" / "skill" / "forward" / file_name
            ).read_text(encoding="utf8")
            used = set(re.findall(r"#[A-Za-z_][A-Za-z0-9_]*", source))
            self.assertLessEqual(used, catalogued)

    def test_parameter_change_preserves_public_identity(self) -> None:
        before_path = "test/skill/forward/add-parameter-before.ufm"
        after_path = "test/skill/forward/add-parameter-after.ufm"
        before = (PROJECT_ROOT / before_path).read_text(encoding="utf8")
        after = (PROJECT_ROOT / after_path).read_text(encoding="utf8")
        self.assertIn("ReviewMandelbrot {", before)
        self.assertIn("ReviewMandelbrot {", after)
        self.assertIn('title = "Review Mandelbrot"', before)
        self.assertIn('title = "Review Mandelbrot"', after)
        self.assertNotIn("@escapeLimit", before)
        self.assertIn("@escapeLimit", after)
        for relative_path in [before_path, after_path]:
            result, report = analyze(relative_path)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(report["summary"]["errors"], 0)

    def test_malformed_fixture_reports_focused_stable_rules(self) -> None:
        result, report = analyze("test/skill/forward/malformed.ufm")
        self.assertEqual(result.returncode, 1, result.stderr)
        rules = {
            diagnostic["rule"]
            for file_report in report["files"]
            for diagnostic in file_report["diagnostics"]
        }
        self.assertIn("UF1001", rules)
        self.assertIn("UF1002", rules)
        self.assertIn("UF1003", rules)

    def test_unknown_import_stays_unchecked_by_default(self) -> None:
        result, report = analyze("test/skill/forward/unknown-class.ufm")
        self.assertEqual(result.returncode, 0, result.stderr)
        rules = {
            diagnostic["rule"]
            for file_report in report["files"]
            for diagnostic in file_report["diagnostics"]
        }
        self.assertNotIn("UF2003", rules)
        self.assertFalse(report["compiled"])

    def test_skill_contract_handles_compiler_and_legacy_boundaries(self) -> None:
        skill = SKILL.read_text(encoding="utf8")
        debug_reference = (
            SKILL.parent / "references" / "debug-and-explain.md"
        ).read_text(encoding="utf8")
        legacy_reference = (
            SKILL.parent / "references" / "legacy-classes-plugins.md"
        ).read_text(encoding="utf8")
        self.assertIn("Do not assign `UF` identifiers", skill)
        self.assertIn("<exact text>", debug_reference)
        self.assertIn("requires rerun", debug_reference)
        self.assertIn("Preserve it", legacy_reference)
        self.assertIn("Do not assume", legacy_reference)

    def test_skill_contract_covers_intent_and_four_validation_categories(self) -> None:
        skill = SKILL.read_text(encoding="utf8")
        design_reference = (
            SKILL.parent / "references" / "design-and-validation.md"
        ).read_text(encoding="utf8")
        native_reference = (
            SKILL.parent / "references" / "native-validation.md"
        ).read_text(encoding="utf8")
        for mode in ["Creative", "Mathematically faithful", "Hybrid"]:
            self.assertIn(mode, skill)
        for category in [
            "Design and algorithm validation",
            "Structural validation",
            "Compilation and runtime validation",
            "Visual validation",
        ]:
            self.assertIn(category, skill)
        self.assertIn("not a fidelity goal", skill)
        self.assertIn("independent reference calculation", design_reference)
        self.assertIn("Do not automate or control", native_reference)

    def test_skill_contract_has_fast_path_and_change_sensitive_validation(self) -> None:
        skill = SKILL.read_text(encoding="utf8")
        self.assertIn("Use the fast path only", skill)
        self.assertIn("comment, caption, hint, or prose-only edits", skill)
        self.assertIn("always run one final structural check", skill)


if __name__ == "__main__":
    unittest.main()
