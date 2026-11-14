"""Rebuild figure images from front photos (<set>-<n>.fig.jpg) into site/img.

Usage: python scripts/apply_front.py [seriesId ...]   (default: every series dir under originals)
Figures without a <set>-<n>.fig.jpg keep their current webp. Old images stay in git history.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from process_images import front_source, safe_process_file  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main(series):
    for sid in series:
        for n in range(1, 40):
            src = front_source(sid, n, ROOT / "originals")
            if src is None:
                continue
            dest = ROOT / "site" / "img" / sid / f"{sid}-{n}.webp"
            print(sid, n, "ok" if safe_process_file(src, dest, "figure_front") else "FAIL", flush=True)


if __name__ == "__main__":
    all_series = sorted(p.name for p in (ROOT / "originals").iterdir() if p.is_dir())
    main(sys.argv[1:] or all_series)
