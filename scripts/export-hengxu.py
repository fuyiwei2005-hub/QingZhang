"""Export Hengxu independently, excluding local data, caches and secrets."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=root.parent / "衡序")
args = parser.parse_args()
destination = args.output.resolve()
source = (root / "apps" / "hengxu").resolve()
if destination == source or source in destination.parents or destination in source.parents:
    raise SystemExit("Output must be separate from the source application")
if destination.exists() and any(destination.iterdir()):
    raise SystemExit("Output folder is not empty; choose a new folder to preserve existing work")
result = subprocess.run(["git", "-c", f"safe.directory={root.as_posix()}", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "apps/hengxu"], cwd=root, check=True, capture_output=True)
files = sorted(set(result.stdout.decode("utf-8").rstrip("\0").split("\0")))
manifest = {}
for name in files:
    original = root / name
    relative = original.relative_to(source)
    if not original.is_file() or original.is_symlink():
        continue
    if any(part in {"node_modules", ".wrangler", "dist", ".next", ".deploy", ".git"} for part in relative.parts):
        raise SystemExit(f"Unexpected generated file: {relative}")
    if original.name.startswith((".env", ".dev.vars")) or original.suffix in {".pem", ".sqlite", ".db"} or original.name == "ai.env":
        raise SystemExit(f"Private file must not be exported: {relative}")
    target = destination / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, target)
    manifest[relative.as_posix()] = hashlib.sha256(target.read_bytes()).hexdigest()
(destination / "源码清单.json").write_text(json.dumps({"project": "衡序 HENGXU", "files": manifest}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Exported {len(manifest)} independent source files to {destination}")
