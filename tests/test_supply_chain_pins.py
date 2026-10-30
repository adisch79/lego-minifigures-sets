"""Supply-chain pin checks: requirements are == pinned, actions use commit SHAs."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class TestPins(unittest.TestCase):
    def test_requirements_pinned(self):
        lines = [re.sub(r"\s+#.*$", "", l).strip()
                 for l in (ROOT / "requirements.txt").read_text().splitlines()]
        lines = [l for l in lines if l and not l.startswith("#")]
        self.assertTrue(lines)
        for l in lines:
            self.assertRegex(l, r"^[A-Za-z0-9_.\-]+==[A-Za-z0-9_.\-+!]+$", l)

    def test_workflow_actions_sha_pinned(self):
        files = list((ROOT / ".github" / "workflows").glob("*.y*ml"))
        self.assertTrue(files)
        found = 0
        for f in files:
            for line in f.read_text().splitlines():
                m = re.match(r"\s*-?\s*uses:\s*(\S+)", line)
                if m:
                    ref = m.group(1).strip("'\"")
                    if ref.startswith("./") or ref.startswith("docker://"):
                        continue
                    found += 1
                    self.assertRegex(ref, r"@[0-9a-f]{40}$", f"{f.name}: {line}")
        self.assertGreater(found, 0)


if __name__ == "__main__":
    unittest.main()
