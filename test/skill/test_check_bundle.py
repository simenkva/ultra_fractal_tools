from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = (
    PROJECT_ROOT
    / "skills"
    / "develop-ultra-fractal-formulas"
    / "scripts"
    / "check_bundle.py"
)


def run_bundle(*arguments: str):
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--repo",
            str(PROJECT_ROOT),
            "--skip-compile",
            *arguments,
        ],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


class CheckBundleTests(unittest.TestCase):
    def test_related_files_preserve_structural_report_and_limits(self) -> None:
        result = run_bundle(
            "--format",
            "json",
            "test/skill/forward/parameterized-power-family.ufm",
            "test/skill/forward/iteration-bands.ucl",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["target"], "UF6")
        self.assertEqual(report["validationLevel"], "bundle-structural")
        self.assertFalse(report["compiled"])
        self.assertFalse(report["rendered"])
        self.assertEqual(report["summary"]["files"], 2)
        self.assertEqual(report["structural"]["summary"]["errors"], 0)

    def test_cross_file_identifier_reuse_is_informational_by_default(self) -> None:
        with tempfile.TemporaryDirectory(prefix="uf-bundle-") as directory:
            root = Path(directory)
            first = root / "first.ufm"
            second = root / "second.ucl"
            first.write_text(
                "Shared {\ninit:\n  z = #pixel\n}\n",
                encoding="utf8",
            )
            second.write_text(
                "Shared {\ninit:\n  float value = 0\nfinal:\n  #index = value\n}\n",
                encoding="utf8",
            )
            result = run_bundle(
                "--format",
                "json",
                "--path-mode",
                "basename",
                str(first),
                str(second),
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            duplicate = next(
                item
                for item in report["advisories"]
                if item["rule"] == "UFB2001"
            )
            self.assertEqual(duplicate["severity"], "information")
            self.assertIn("not a UF6 error", duplicate["message"])
            self.assertNotIn(directory, result.stdout)

    def test_manifest_expectations_use_advisories_not_uf_diagnostics(self) -> None:
        with tempfile.TemporaryDirectory(prefix="uf-bundle-manifest-") as directory:
            root = Path(directory)
            source = root / "family.ufm"
            source.write_text(
                "ActualEntry {\ninit:\n  z = #pixel\n}\n",
                encoding="utf8",
            )
            manifest = root / "bundle.json"
            manifest.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "target": "UF6",
                        "files": [
                            {
                                "path": "family.ufm",
                                "role": "coloring",
                                "expectedDefinitions": [
                                    {"name": "ActualEntry", "kind": "class"},
                                    {"name": "MissingEntry", "kind": "entry"},
                                ],
                            }
                        ],
                        "conventions": {
                            "uniqueDefinitionIdentifiers": True
                        },
                    }
                ),
                encoding="utf8",
            )
            result = run_bundle(
                "--format",
                "json",
                "--path-mode",
                "basename",
                "--fail-on-advisory",
                "--manifest",
                str(manifest),
            )
            self.assertEqual(result.returncode, 1, result.stderr)
            report = json.loads(result.stdout)
            rules = {item["rule"] for item in report["advisories"]}
            self.assertEqual(rules, {"UFB1001", "UFB1002", "UFB1003"})
            self.assertEqual(report["structural"]["summary"]["errors"], 0)
            self.assertNotIn(directory, result.stdout)

    def test_manifest_rejects_non_uf6_target(self) -> None:
        with tempfile.TemporaryDirectory(prefix="uf-bundle-target-") as directory:
            manifest = Path(directory) / "bundle.json"
            manifest.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "target": "UF7",
                        "files": [
                            {"path": "formula.ufm", "role": "fractal"}
                        ],
                    }
                ),
                encoding="utf8",
            )
            result = run_bundle("--manifest", str(manifest))
            self.assertEqual(result.returncode, 2)
            self.assertIn("target must be 'UF6'", result.stderr)


if __name__ == "__main__":
    unittest.main()
