# Contributing

Thanks for helping! Issues and pull requests are welcome **in English or Spanish**
(¡también en castellano!).

## Reporting a bug

Open an issue with the bug template and include:

- your OS, terminal (Windows Terminal, iTerm2, tmux…) and shell,
- `cses --version` and `claude --version`,
- what you pressed or clicked, what you expected and what happened.

**Please don't paste conversation content or screenshots with private data**: `cses`
shows your real conversations. Blur titles and paths, or reproduce it with test data
(`scripts/fotograma.tsx` can render the UI as text, see below).

## Development

Needs Node.js 22+.

```bash
npm install
npm run dev            # run from source (tsx), no build
npm test               # jest
npm run lint
npm run typecheck
npm run build          # compile to dist/
```

`scripts/fotograma.tsx` renders the UI as plain text with your local data and can
replay keys and mouse events, which is handy to check a layout without a terminal:

```bash
KEYS=left,down,right,^e COLS=140 ROWS=34 npx tsx scripts/fotograma.tsx
```

Set `CSES_DIR` to a temporary folder to keep your real index and favorites untouched,
and `CSES_LANG=en` or `es` to pick the language. `PANEL=<account>` renders the accounts
panel instead, as if `claude` were open with that account.

To try the account switch without a real `claude`, point `CSES_CLAUDE` at a script that
just waits; the panel and the supervisor talk through files in `$CSES_DIR/paneles/`
(see `src/core/panelLink.ts` and `src/core/supervisor.ts`).

## Layout

| Path | What's there |
|---|---|
| `src/cli.tsx` | arguments, subcommands, terminal setup, launching `claude` |
| `src/App.tsx` | the three-column UI and all key/mouse handling |
| `src/core/indexer.ts` | incremental reader of Claude Code transcripts (`*.jsonl`) |
| `src/core/tree.ts` | folder tree, search and stats |
| `src/core/accounts.ts`, `accountAdmin.ts` | account detection and creation |
| `src/core/launcher.ts` | running `claude` here or in a new tab |
| `src/core/running.ts` | which conversations are open right now |
| `src/ui/` | preview builder, text fitting, mouse input filter, theme |
| `src/i18n.ts` | every user-facing string, in Spanish and English |

## Pull requests

- One topic per PR. Open an issue first for big changes, so we can agree on the approach.
- Add or update tests for anything in `src/core/` or `src/ui/`.
- Every user-facing text goes through `src/i18n.ts`, **in both languages**. If you only
  speak one, write it and say so in the PR: someone will translate it.
- `npm run lint`, `npm run typecheck` and `npm test` must pass (CI runs them too).
- The Claude Code transcript format isn't a public API and changes between versions.
  If you depend on a new field, handle it being missing.

Code comments are mostly in Spanish (the project started that way); new comments can be
in either language.

## Releases (maintainers)

Bump `version` in `package.json`, move the `Unreleased` notes in `CHANGELOG.md` under the
new version, and publish a GitHub release tagged `vX.Y.Z`. The `Publish` workflow checks
that the tag matches `package.json` and publishes to npm with trusted publishing.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
