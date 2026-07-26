from __future__ import annotations

from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = (
    PROJECT_ROOT / "skills" / "develop-ultra-fractal-formulas"
)
EXPECTED_FILES = {
    "SKILL.md",
    "agents/openai.yaml",
    "references/create-and-modify.md",
    "references/design-and-validation.md",
    "references/debug-and-explain.md",
    "references/evidence-map.md",
    "references/bundles.md",
    "references/legacy-classes-plugins.md",
    "references/native-validation.md",
    "references/parameters-and-review.md",
    "scripts/analyze_formula.py",
    "scripts/check_bundle.py",
    "scripts/find_corpus_examples.py",
    "scripts/search_manual.py",
}


class SkillPackageTests(unittest.TestCase):
    def test_package_contains_only_expected_files(self) -> None:
        files = {
            path.relative_to(SKILL_ROOT).as_posix()
            for path in SKILL_ROOT.rglob("*")
            if path.is_file() and "__pycache__" not in path.parts
        }
        self.assertEqual(files, EXPECTED_FILES)
        self.assertFalse(
            any(path.suffix == ".pyc" for path in SKILL_ROOT.rglob("*"))
        )

    def test_package_excludes_private_inputs_and_local_paths(self) -> None:
        combined = "\n".join(
            path.read_text(encoding="utf8")
            for path in SKILL_ROOT.rglob("*")
            if path.is_file() and path.suffix in {".md", ".yaml", ".py"}
        )
        self.assertNotIn("/Users/", combined)
        self.assertNotIn("uf6-manual.pdf", {path.name for path in SKILL_ROOT.rglob("*")})
        self.assertNotIn("uf-formulas", {path.name for path in SKILL_ROOT.rglob("*")})
        self.assertFalse(any(path.suffix == ".pdf" for path in SKILL_ROOT.rglob("*")))
        self.assertFalse(
            any(
                path.suffix.lower() in {".ufm", ".ucl", ".uxf", ".ulb"}
                for path in SKILL_ROOT.rglob("*")
            )
        )

    def test_skill_routes_every_reference_and_states_limits(self) -> None:
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf8")
        for reference in sorted(
            file
            for file in EXPECTED_FILES
            if file.startswith("references/")
        ):
            self.assertIn(f"({reference})", skill)
        for required in [
            "Structural validation",
            "Design and algorithm validation",
            "Compilation and runtime validation",
            "Visual validation",
            "Creative",
            "Mathematically faithful",
            "Hybrid",
            "fast path",
            "Never call a formula compiled",
            "Do not invent",
            "Ultra Fractal 6",
        ]:
            self.assertIn(required, skill)

    def test_agent_prompt_names_the_skill(self) -> None:
        metadata = (SKILL_ROOT / "agents" / "openai.yaml").read_text(
            encoding="utf8"
        )
        self.assertIn("$develop-ultra-fractal-formulas", metadata)

    def test_native_workflow_is_manual_and_contains_no_gui_automation(self) -> None:
        native = (
            SKILL_ROOT / "references" / "native-validation.md"
        ).read_text(encoding="utf8")
        self.assertIn("Keep the native pass manual", native)
        self.assertIn("Do not automate or control", native)
        for forbidden in ["AppleScript", "osascript", "pyautogui", "WinAppDriver"]:
            self.assertNotIn(forbidden, native)


if __name__ == "__main__":
    unittest.main()
