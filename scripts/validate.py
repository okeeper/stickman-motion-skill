#!/usr/bin/env python3
"""Check the skill manifest, local Markdown links, and story example structure.

This is a repository check, not a renderer or a mathematical proof checker.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

import yaml


def validate(root: Path) -> list[str]:
    root = root.resolve()
    errors: list[str] = []

    def read(path: Path) -> str:
        try:
            return path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            errors.append(f"{path.relative_to(root)}: {exc}")
            return ""

    def parse_yaml(text: str, label: str):
        try:
            return yaml.safe_load(text)
        except yaml.YAMLError as exc:
            errors.append(f"{label}: invalid YAML: {exc}")
            return None

    skill = read(root / "SKILL.md")
    frontmatter = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", skill, re.S)
    if not frontmatter:
        errors.append("SKILL.md: missing YAML frontmatter")
    else:
        metadata = parse_yaml(frontmatter.group(1), "SKILL.md")
        if not isinstance(metadata, dict):
            errors.append("SKILL.md: frontmatter must be a mapping")
        else:
            name = metadata.get("name")
            if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) or len(name) > 64:
                errors.append("SKILL.md: name must be a lowercase hyphenated name of at most 64 characters")
            description = metadata.get("description")
            if not isinstance(description, str) or not description.strip() or len(description) > 1024:
                errors.append("SKILL.md: description must contain 1–1024 characters")
        if not skill[frontmatter.end():].strip():
            errors.append("SKILL.md: instructions are empty")

    markdown = sorted(root.glob("*.md"))
    for directory in ("references", "docs", "examples", "demos"):
        markdown.extend(sorted((root / directory).rglob("*.md")))
    # Check authored Web docs without traversing dependencies or generated output.
    for relative in ("web/README.md", "web/assets/fonts/README.md", "motion/README.md"):
        if (root / relative).is_file():
            markdown.append(root / relative)
    for path in markdown:
        for match in re.finditer(r"!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+[^)]*)?\)", read(path)):
            target = match.group(1).strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            relative = Path(unquote(parsed.path))
            resolved = (path.parent / relative).resolve()
            if relative.is_absolute() or not resolved.is_relative_to(root):
                errors.append(f"{path.relative_to(root)}: local link escapes repository: {target}")
            elif not resolved.exists():
                errors.append(f"{path.relative_to(root)}: missing local link: {target}")

    examples = sorted((root / "examples").glob("*.yaml"))
    if not examples:
        errors.append("examples/: no story specifications found")
    for path in examples:
        label = str(path.relative_to(root))
        data = parse_yaml(read(path), label)
        if not isinstance(data, dict):
            errors.append(f"{label}: example must be a mapping")
            continue
        for field in ("scene_id", "intent", "concept"):
            if not isinstance(data.get(field), str) or not data[field].strip():
                errors.append(f"{label}: {field} must be a non-empty string")
        assumptions = data.get("assumptions")
        if not isinstance(assumptions, list) or not assumptions or not all(isinstance(item, str) and item.strip() for item in assumptions):
            errors.append(f"{label}: assumptions must be a non-empty list of strings")
        objects = data.get("objects")
        if not isinstance(objects, list) or not objects:
            errors.append(f"{label}: objects must be a non-empty list")
        else:
            ids: set[str] = set()
            for obj in objects:
                if not isinstance(obj, dict) or not isinstance(obj.get("id"), str) or not obj["id"].strip():
                    errors.append(f"{label}: each object needs a string id")
                elif obj["id"] in ids:
                    errors.append(f"{label}: duplicate object id: {obj['id']}")
                else:
                    ids.add(obj["id"])
        beats = data.get("beats")
        if not isinstance(beats, list) or not beats:
            errors.append(f"{label}: beats must be a non-empty list")
        else:
            operations = {"expression_edit", "evaluate", "equivalent_rewrite", "spatial_metaphor"}
            for index, beat in enumerate(beats):
                if not isinstance(beat, dict):
                    errors.append(f"{label}: beat {index + 1} must be a mapping")
                    continue
                for field in ("intent", "action"):
                    if not isinstance(beat.get(field), str) or not beat[field].strip():
                        errors.append(f"{label}: beat {index + 1} needs {field}")
                operation = beat.get("operation")
                if operation is not None and (not isinstance(operation, str) or operation not in operations):
                    errors.append(f"{label}: beat {index + 1} has an unsupported operation")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors = validate(args.root)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("PASS: skill manifest, local file links, and story example structure")
    print("Not checked: remote links, mathematical correctness, rendered video, or audio")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
