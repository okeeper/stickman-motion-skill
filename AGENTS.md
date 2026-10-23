# Repository guidance

This repository contains an instruction-first skill for concept-driven stick-figure animation. Keep the README accurate about what is implemented and what has been visually validated.

- The canonical skill is the root `SKILL.md`; its name is `stickman-motion-skill`.
- Keep Chinese documentation clear and self-contained. Link substantial workflow detail from the skill instead of duplicating it.
- Preserve the difference between expression editing, evaluation, equivalent rewriting, and spatial metaphor. State mathematical assumptions.
- Run `python scripts/validate.py` after edits. For a changed executable helper, also check a relevant failure case.
- Use actual artifacts to support claims of animation quality. Structural validation does not establish visual or mathematical correctness.
- Local `analysis/` and `skill-design/` directories are research/archive material. Do not publish downloaded media, extracted frames, signed download URLs, or local account data.
- Follow the user's current task scope; a documentation change does not require producing a video or installing render dependencies.
