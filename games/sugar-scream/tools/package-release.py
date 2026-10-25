"""Packages the Stake Engine upload zips into release/.

    npm run math:publish && npm run build && npm run release

  release/sugar-scream-math.zip      index.json, books_<mode>.jsonl.zst, lookUpTable_<mode>_0.csv
  release/sugar-scream-frontend.zip  the static build (contents of dist/, index.html at the root)

Files sit at the root of each zip. The script refuses to write a zip larger than the
limit (default 50 MB, --limit to change).
"""
import argparse
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MB = 1_000_000

ap = argparse.ArgumentParser()
ap.add_argument("--math", default=str(ROOT / "math-output" / "publish"))
ap.add_argument("--dist", default=str(ROOT / "dist"))
ap.add_argument("--out", default=str(ROOT / "release"))
ap.add_argument("--limit", type=float, default=50.0, help="maximum zip size in MB")
args = ap.parse_args()

math_dir, dist, out = Path(args.math), Path(args.dist), Path(args.out)
out.mkdir(exist_ok=True)

index = json.loads((math_dir / "index.json").read_text())
math_files = [math_dir / "index.json"]
for m in index["modes"]:
    math_files += [math_dir / m["events"], math_dir / m["weights"]]
missing = [str(p) for p in math_files if not p.exists()]
if missing:
    raise SystemExit(f"missing math files: {missing} (run npm run math:publish)")
if not (dist / "index.html").exists():
    raise SystemExit("dist/index.html missing (run npm run build)")


def pack(name: str, files: list[tuple[Path, str]]) -> None:
    target = out / name
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for src, arc in files:
            # .zst and .webp are already compressed; storing them avoids wasted work
            z.write(src, arc, compress_type=zipfile.ZIP_STORED if src.suffix in (".zst", ".webp", ".woff", ".woff2") else zipfile.ZIP_DEFLATED)
    size = target.stat().st_size
    status = "OK" if size <= args.limit * MB else "TOO LARGE"
    print(f"{status:9} {target.relative_to(ROOT)}  {size / MB:.1f} MB  ({len(files)} files)")
    if size > args.limit * MB:
        target.unlink()
        raise SystemExit(f"{name} is over {args.limit} MB")


pack("sugar-scream-math.zip", [(p, p.name) for p in math_files])
pack("sugar-scream-frontend.zip", [(p, str(p.relative_to(dist))) for p in sorted(dist.rglob("*")) if p.is_file()])
