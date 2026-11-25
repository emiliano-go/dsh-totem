# Provenance

`SKILL.md` is vendored verbatim from
[GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance),
path `skills/modern-web-guidance/SKILL.md`, fetched 2026-11-17 from `main`.

- Upstream license: Apache-2.0 (see the upstream `LICENSE`).
- The skill is self-contained: every command runs through
  `npx -y modern-web-guidance@latest`, so the guide data is never copied here.
  The `--skill-version` pin inside `SKILL.md` is upstream's, not ours.
- Refresh with:

  ```bash
  curl -sL https://raw.githubusercontent.com/GoogleChrome/modern-web-guidance/main/skills/modern-web-guidance/SKILL.md \
    -o .agents/skills/modern-web-guidance/SKILL.md
  ```
