#!/usr/bin/env python3
"""Reusable local animation production CLI; see references/tooling.md."""

from __future__ import annotations
import argparse
import importlib.metadata
import json
import shutil
import sys
from pathlib import Path
from motion_tools import VERSION
from motion_tools.common import ToolError, run


def doctor():
    checks = {}
    ok = True
    for name in ("ffmpeg", "ffprobe"):
        found = shutil.which(name)
        checks[name] = None
        if found:
            checks[name] = run([found, "-version"]).decode().splitlines()[0]
        else:
            ok = False
    for name in ("Pillow", "numpy", "PyYAML"):
        try:
            checks[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            checks[name] = None
            ok = False
    if checks["ffmpeg"]:
        encoders = run([shutil.which("ffmpeg"), "-hide_banner", "-encoders"]).decode()
        for name in ("libx264", "aac"):
            checks[name] = any(
                line.split()[1:2] == [name] for line in encoders.splitlines()
            )
            ok = ok and checks[name]
    return {"version": VERSION, "ready": ok, "checks": checks}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--version", action="version", version=VERSION)
    commands = p.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="Report local tools without installing anything")
    init = commands.add_parser(
        "init", help="Create a self-contained production project"
    )
    init.add_argument("directory", type=Path)
    init.add_argument(
        "--demo",
        default="complex-rotation",
        choices=("negative-ride", "binary-search", "complex-rotation"),
    )
    render = commands.add_parser(
        "render", help="Render a project or bounded source-time window"
    )
    render.add_argument("project", type=Path)
    render.add_argument("--start", type=float, default=0)
    render.add_argument("--end", type=float)
    render.add_argument("--profile", choices=("preview", "final"), default="final")
    render.add_argument("--out", type=Path)
    render.add_argument("--force", action="store_true")
    render.add_argument("--stills", type=float, nargs="+")
    edit = commands.add_parser(
        "edit", help="Edit local clips using a versioned JSON timeline"
    )
    edit.add_argument("spec", type=Path)
    edit.add_argument("--out", type=Path)
    edit.add_argument("--plan", action="store_true")
    review = commands.add_parser(
        "inspect", help="Decode media and generate a contact sheet and QA facts"
    )
    review.add_argument("video", type=Path)
    review.add_argument("--out", type=Path, required=True)
    review.add_argument("--samples", type=int, default=12)
    delivery = commands.add_parser(
        "deliver", help="Check and copy a film into a new delivery directory"
    )
    delivery.add_argument("video", type=Path)
    delivery.add_argument("--out", type=Path, required=True)
    check = commands.add_parser(
        "verify", help="Check a delivery package against its file manifest"
    )
    check.add_argument("directory", type=Path)
    args = p.parse_args()
    try:
        if args.command == "doctor":
            result = doctor()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ready"] else 1
        if args.command == "init":
            from motion_tools.project import initialize

            result = initialize(args.directory, args.demo)
        elif args.command == "render":
            from motion_tools.project import render as do_render

            if args.stills is not None and args.out is None:
                raise ToolError("--stills requires --out directory")
            result = do_render(
                args.project,
                start=args.start,
                end=args.end,
                out=args.out,
                profile=args.profile,
                force=args.force,
                stills=args.stills,
            )
        elif args.command == "edit":
            from motion_tools.edit import plan, summary, execute

            timeline = plan(args.spec, args.out)
            result = summary(timeline) if args.plan else execute(timeline)
        else:
            from motion_tools.review import inspect, deliver, verify

            if args.command == "inspect":
                result = inspect(args.video, args.out, args.samples)
            elif args.command == "deliver":
                result = deliver(args.video, args.out)
            else:
                result = verify(args.directory)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ToolError, OSError, ImportError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
