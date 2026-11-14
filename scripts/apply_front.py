"""Rebuild figure images from front photos (<set>-<n>.fig.jpg) into site/img.

Usage: python scripts/apply_front.py [seriesId ...]   (default: every series dir under originals)
Figures without a <set>-<n>.fig.jpg keep their current webp. Old images stay in git history.
Needs requirements-images.txt and torch (BiRefNet model). Exit code 1 if anything failed.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from process_images import safe_process_file  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORIGINALS = ROOT / "originals"


def find_jobs(series):
    """List of (sid, n, src) for every <sid>-<n>.fig.jpg under originals/<sid>."""
    jobs = []
    for sid in series:
        found = []
        for src in (ORIGINALS / sid).glob(f"{sid}-*.fig.jpg"):
            num = src.name[len(sid) + 1:-len(".fig.jpg")]
            if num.isdigit():
                found.append((int(num), src))
        jobs.extend((sid, n, src) for n, src in sorted(found))
    return jobs


def main(argv):
    if not ORIGINALS.is_dir():
        print(f"ERROR: originals folder not found: {ORIGINALS}", file=sys.stderr)
        return 1
    available = sorted(p.name for p in ORIGINALS.iterdir() if p.is_dir())
    series = argv or available
    bad = [s for s in series if s not in available]
    if bad:
        print(f"ERROR: no originals/<id> folder for: {', '.join(bad)}", file=sys.stderr)
        return 1
    jobs = find_jobs(series)
    if not jobs:
        print("No front photos found, nothing to do.")
        return 0
    try:
        import seg_model
        seg_model._load()
    except Exception as e:
        print(f"ERROR: cannot load segmentation model ({type(e).__name__}: {e}). "
              "Install requirements-images.txt and torch.", file=sys.stderr)
        return 1
    failed = 0
    for sid, n, src in jobs:
        dest = ROOT / "site" / "img" / sid / f"{sid}-{n}.webp"
        ok = safe_process_file(src, dest, "figure_front")
        failed += 0 if ok else 1
        print(sid, n, "ok" if ok else "FAIL", flush=True)
    print(f"Done: {len(jobs) - failed} ok, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
