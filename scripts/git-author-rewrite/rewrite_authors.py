#!/usr/bin/env python3
"""
Analyze and rewrite git commit authors per docs/plan-implement-module.md.

Usage:
  python scripts/git-author-rewrite/rewrite_authors.py --dry-run
  python scripts/git-author-rewrite/rewrite_authors.py --rewrite
  python scripts/git-author-rewrite/rewrite_authors.py --verify
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

from authors import (
    AUTHORS,
    HARD_SCORE_FLOOR,
    MEMBER_ORDER,
    Author,
    classify_files,
    confidence_of,
    should_keep_author,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
MAP_FILE = Path(__file__).resolve().parent / "commit_author_map.json"
CALLBACK_FILE = Path(__file__).resolve().parent / "filter_repo_callback.py"
REPORT_FILE = Path(__file__).resolve().parent / "dry_run_report.csv"


def run_git(*args: str, cwd: Path | None = None) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd or REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
        encoding="utf-8",
        errors="replace",
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


def classify_all() -> list[dict]:
    """Return classified rows for every non-KEEP commit on HEAD."""
    rows: list[dict] = []
    for sha in list_commits():
        name, email, subject = commit_meta(sha)
        if should_keep_author(email):
            continue
        files = changed_files(sha)
        assignee_key, totals = classify_files(files, subject)
        conf = confidence_of(totals, assignee_key)
        rows.append(
            {
                "sha": sha,
                "old_name": name,
                "old_email": email,
                "assignee": assignee_key,
                "confidence": conf,
                "subject": subject[:120],
            }
        )
    return rows


def rebalance(rows: list[dict], tolerance: int = 1) -> list[dict]:
    """
    Move soft (low-confidence) commits from over-quota members to under-quota
    members so counts sit within target ± tolerance.
    """
    n = len(rows)
    if n == 0:
        return rows

    members = list(MEMBER_ORDER)
    target = n // len(members)
    # Spread remainder: first (n % 5) members get target+1
    remainder = n % len(members)
    caps = {
        m: target + (1 if i < remainder else 0)
        for i, m in enumerate(members)
    }

    counts = Counter(r["assignee"] for r in rows)

    def over_members() -> list[str]:
        return [m for m in members if counts[m] > caps[m] + tolerance]

    def under_members() -> list[str]:
        return [m for m in members if counts[m] < caps[m] - tolerance]

    # Prefer moving softest commits first
    movable_idxs = sorted(
        (i for i, r in enumerate(rows) if r["confidence"] < HARD_SCORE_FLOOR),
        key=lambda i: rows[i]["confidence"],
    )

    moved = 0
    for idx in movable_idxs:
        overs = over_members()
        unders = under_members()
        if not overs or not unders:
            break
        row = rows[idx]
        donor = row["assignee"]
        if donor not in overs:
            continue
        # Pick under with largest deficit
        receiver = min(unders, key=lambda m: counts[m] - caps[m])
        if receiver == donor:
            continue
        row["assignee"] = receiver
        row["rebalanced"] = True
        counts[donor] -= 1
        counts[receiver] += 1
        moved += 1

    # Second pass: if still uneven, allow moving medium-soft (up to HARD+40)
    if over_members() and under_members():
        movable_idxs = sorted(
            (
                i
                for i, r in enumerate(rows)
                if r["confidence"] < HARD_SCORE_FLOOR + 40
                and not r.get("rebalanced")
            ),
            key=lambda i: rows[i]["confidence"],
        )
        for idx in movable_idxs:
            overs = over_members()
            unders = under_members()
            if not overs or not unders:
                break
            row = rows[idx]
            donor = row["assignee"]
            if donor not in overs:
                continue
            receiver = min(unders, key=lambda m: counts[m] - caps[m])
            if receiver == donor:
                continue
            row["assignee"] = receiver
            row["rebalanced"] = True
            counts[donor] -= 1
            counts[receiver] += 1
            moved += 1

    hi = target + (1 if remainder else 0)
    print(f"Rebalance: target={target}-{hi}, moved={moved}")
    print("Post-rebalance counts:", dict(sorted(counts.items())))
    return rows


def build_map(rows: list[dict]) -> dict[str, dict[str, str]]:
    mapping: dict[str, dict[str, str]] = {}
    for row in rows:
        author: Author = AUTHORS[row["assignee"]]
        if author.name == row["old_name"] and author.email.lower() == row["old_email"].lower():
            continue
        mapping[row["sha"]] = {
            "assignee": row["assignee"],
            "name": author.name,
            "email": author.email,
            "old_name": row["old_name"],
            "old_email": row["old_email"],
            "subject": row["subject"],
            "rebalanced": str(bool(row.get("rebalanced"))),
        }
    return mapping


def dry_run(rows: list[dict], mapping: dict[str, dict[str, str]]) -> None:
    final_counts: Counter[str] = Counter(r["assignee"] for r in rows)
    rewrite_counts: Counter[str] = Counter()

    with REPORT_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "sha",
                "old_name",
                "old_email",
                "new_name",
                "new_email",
                "assignee",
                "confidence",
                "rebalanced",
                "subject",
            ]
        )
        for row in rows:
            author = AUTHORS[row["assignee"]]
            writer.writerow(
                [
                    row["sha"][:12],
                    row["old_name"],
                    row["old_email"],
                    author.name,
                    author.email,
                    row["assignee"],
                    row["confidence"],
                    "yes" if row.get("rebalanced") else "",
                    row["subject"],
                ]
            )
            if row["sha"] in mapping:
                rewrite_counts[row["assignee"]] += 1

    keep = len(list_commits()) - len(rows)
    print(f"Total commits: {len(list_commits())}")
    print(f"Keep unchanged (AtuDk3): {keep}")
    print(f"Assignable: {len(rows)}")
    print(f"Will rewrite: {len(mapping)}")
    print("\nFinal author distribution (all assignable commits):")
    for key in MEMBER_ORDER:
        author = AUTHORS[key]
        print(f"  {author.name} <{author.email}>: {final_counts[key]}")
    print(f"\nReport: {REPORT_FILE}")


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
    out = run_git("shortlog", "-sn", "--all", "--no-merges")
    print("\n=== git shortlog -sn --all --no-merges ===")
    print(out)
    emails = run_git("log", "--format=%ae", "--no-merges").strip().splitlines()
    unique = sorted(set(e.lower() for e in emails))
    print("\n=== Unique author emails (no-merges) ===")
    for e in unique:
        print(f"  {e}")
    print(f"\nTotal unique emails: {len(unique)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--rewrite", action="store_true")
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--no-rebalance", action="store_true", help="Skip phase-3 even distribution")
    parser.add_argument("--tolerance", type=int, default=1, help="Allowed deviation from target count")
    args = parser.parse_args()

    if args.verify:
        verify()
        return 0

    rows = classify_all()
    if not args.no_rebalance:
        rows = rebalance(rows, tolerance=args.tolerance)
    mapping = build_map(rows)

    if args.rewrite:
        if not mapping:
            print("Nothing to rewrite.")
            return 0
        write_callback(mapping)
        dry_run(rows, mapping)
        rewrite(mapping)
        verify()
        return 0

    dry_run(rows, mapping)
    write_callback(mapping)
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
