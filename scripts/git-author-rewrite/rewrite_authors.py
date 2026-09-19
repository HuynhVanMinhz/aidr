#!/usr/bin/env python3
"""
Analyze and rewrite git commit authors per docs/plan-implement-module.md.

Usage:
  python scripts/git-author-rewrite/rewrite_authors.py --dry-run
  python scripts/git-author-rewrite/rewrite_authors.py --rewrite
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from pathlib import Path

from authors import AUTHORS, Author, classify_files, should_keep_author

REPO_ROOT = Path(__file__).resolve().parents[2]
MAP_FILE = Path(__file__).resolve().parent / "commit_author_map.json"
CALLBACK_FILE = Path(__file__).resolve().parent / "filter_repo_callback.py"


def run_git(*args: str, cwd: Path | None = None) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd or REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def list_commits() -> list[str]:
    out = run_git("log", "--format=%H", "--reverse")
    return [line.strip() for line in out.splitlines() if line.strip()]


def commit_meta(sha: str) -> tuple[str, str, str]:
    out = run_git("log", "-1", "--format=%an|%ae|%s", sha)
    name, email, subject = out.strip().split("|", 2)
    return name, email, subject


def changed_files(sha: str) -> list[str]:
    if _is_root_commit(sha):
        out = run_git("show", "--pretty=format:", "--name-only", sha)
    else:
        out = run_git("diff-tree", "--no-commit-id", "--name-only", "-r", sha)
    return [line.strip() for line in out.splitlines() if line.strip()]


def _is_root_commit(sha: str) -> bool:
    parents = run_git("rev-list", "--parents", "-n", "1", sha).strip().split()
    return len(parents) == 1


def build_map() -> dict[str, dict[str, str]]:
    mapping: dict[str, dict[str, str]] = {}
    for sha in list_commits():
        name, email, subject = commit_meta(sha)
        if should_keep_author(email):
            continue
        files = changed_files(sha)
        assignee_key, _scores = classify_files(files, subject)
        author: Author = AUTHORS[assignee_key]
        if author.name == name and author.email.lower() == email.lower():
            continue
        mapping[sha] = {
            "assignee": assignee_key,
            "name": author.name,
            "email": author.email,
            "old_name": name,
            "old_email": email,
            "subject": subject[:120],
        }
    return mapping


def dry_run(mapping: dict[str, dict[str, str]]) -> None:
    report_path = Path(__file__).resolve().parent / "dry_run_report.csv"
    counts: dict[str, int] = {k: 0 for k in AUTHORS}
    keep = len(list_commits()) - len(mapping)

    with report_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sha", "old_name", "old_email", "new_name", "new_email", "assignee", "subject"])
        for sha, info in mapping.items():
            writer.writerow([
                sha[:12],
                info["old_name"],
                info["old_email"],
                info["name"],
                info["email"],
                info["assignee"],
                info["subject"],
            ])
            counts[info["assignee"]] += 1

    print(f"Total commits: {len(list_commits())}")
    print(f"Keep unchanged (AtuDk3): {keep}")
    print(f"Will rewrite: {len(mapping)}")
    print("\nNew author distribution (rewritten commits only):")
    for key, author in AUTHORS.items():
        print(f"  {author.name} <{author.email}>: {counts[key]}")
    print(f"\nReport: {report_path}")


def write_callback(mapping: dict[str, dict[str, str]]) -> None:
    map_json = json.dumps(mapping)
    CALLBACK_FILE.write_text(
        f'''# Auto-generated - do not edit
import json

_MAP = json.loads({map_json!r})

KEEP = {{b"127426449+AtuDk3@users.noreply.github.com"}}

oid = commit.original_id.decode("ascii")
if commit.author_email.lower() not in KEEP:
    entry = _MAP.get(oid)
    if entry:
        commit.author_name = entry["name"].encode("utf-8")
        commit.author_email = entry["email"].encode("utf-8")
        commit.committer_name = commit.author_name
        commit.committer_email = commit.author_email
''',
        encoding="utf-8",
    )
    MAP_FILE.write_text(json.dumps(mapping, indent=2), encoding="utf-8")


def rewrite(mapping: dict[str, dict[str, str]]) -> None:
    write_callback(mapping)
    callback_body = CALLBACK_FILE.read_text(encoding="utf-8")

    # git filter-repo --commit-callback expects inline Python
    cmd = [
        sys.executable,
        "-m",
        "git_filter_repo",
        "--force",
        "--commit-callback",
        callback_body,
    ]
    print("Running git filter-repo (this may take a minute)...")
    subprocess.run(cmd, cwd=REPO_ROOT, check=True)
    print("Rewrite complete.")


def verify() -> None:
    out = run_git("shortlog", "-sn", "--all")
    print("\n=== git shortlog -sn --all ===")
    print(out)
    emails = run_git("log", "--format=%ae").strip().splitlines()
    unique = sorted(set(e.lower() for e in emails))
    print("\n=== Unique author emails ===")
    for e in unique:
        print(f"  {e}")
    print(f"\nTotal unique emails: {len(unique)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--rewrite", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    if args.verify:
        verify()
        return 0

    mapping = build_map()

    if args.rewrite:
        if not mapping:
            print("Nothing to rewrite.")
            return 0
        rewrite(mapping)
        verify()
        return 0

    dry_run(mapping)
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
