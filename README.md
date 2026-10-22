# claude-sesiones — every Claude Code conversation, one terminal

**English** · [Español](README.es.md)

A terminal browser for your Claude Code conversations across **every folder and every
account**, like the claude.ai sidebar but in the CLI. Pick one and it reopens in its
own folder, with its own account — no more remembering where you were.

```
 ✻ cses                                                                                 account ▸ work · you@company.com ·auto
  ⌕ ▏type to search conversations
╭────────────────────────────╮╭────────────────────────────────────────────────╮╭────────────────────────────────────────────╮
│ Folders                    ││ All · 41                                       ││ Preview                                    │
│ ▌ All                   41 ││ Today                                          ││ Database migration                         │
│  ★ Favorites               ││ ▌● Database migration        api-pagos   12:31 ││ proyectos/api-pagos  ⎇ main                │
│    api-pagos             8 ││    New landing page          web-tienda  11:22 ││ Oct 20 20:15 → today 12:31 · 36 messages   │
│  Folders                   ││ Yesterday                                      ││ ● Open now in another terminal             │
│  ▾ proyectos            33 ││    Android login bug         app-movil    yest ││ account ▸ work · you@company.com           │
│    ▸ api-pagos           8 ││    Quarterly report          clientes     yest ││ ────────────────────────────────────────── │
│    ▸ web-tienda         12 ││ Previous 7 days                                ││ ❯ You  today 12:20                         │
│      app-movil           5 ││    Image cache               web-tienda    Mon ││   what if we do it in batches?             │
│  ▸ clientes              8 ││    Integration tests         api-pagos     Sun ││ ✻ Claude  today 12:21                      │
╰────────────────────────────╯╰────────────────────────────────────────────────╯╰────────────────────────────────────────────╯
 ↵ open  ^T tab  ^N new  ^F fork  ^E favorite  ^G its folder  ^A account  esc back
```

## Why

`claude --resume` is tied to the folder you started the conversation in. With many
projects (and more than one account) finding yesterday's conversation means guessing
the folder first. `cses` reads the history Claude Code already keeps on disk and lets
you browse all of it at once.

## Features

- **Three columns**: folders | conversations | preview. `←` `→` move between them.
- **Folder tree** with conversation counts. Expand any folder on disk, not only the
  ones with history, and start a new conversation there.
- **Type to search** in the focused column, ignoring case and accents.
- **Favorites** (`Ctrl+E`) for conversations and folders, always on top.
- **Mouse**: click to select, double-click to open or expand, wheel to scroll.
- **Back with `esc`**: returns to where you were before the last jump.
- **Several accounts** (`~/.claude-*` config dirs): switch with `Ctrl+A`, or set rules
  per folder. Open conversations in new Windows Terminal or tmux tabs (`Ctrl+T`) and
  run several accounts at the same time.
- **Knows what's open**: `●` marks conversations running in another terminal, and
  `cses` asks before opening one twice (or opens a fork).
- **Fast**: an incremental index reads only what changed (2.5 GB of history in ~3 s
  the first time, ~35 ms after that).
- **English and Spanish**, picked from your system language.

## Install

Needs Node.js 22 or newer and Claude Code.

```bash
npm install -g claude-sesiones      # or: pnpm add -g / yarn global add / bun add -g
cses                                # or the long name: claude-sesiones
```

From source:

```bash
git clone https://github.com/VolmerES/claude-sesiones.git
cd claude-sesiones
npm install && npm run build && npm link
```

### Stay in the conversation's folder after quitting

A program can't change its parent shell's directory, so wrap `cses` in a function.
Bash or zsh (Git Bash included):

```bash
cses() {
  local f rc d
  f="$(mktemp)"
  CSES_CD="$(command -v cygpath >/dev/null && cygpath -w "$f" || echo "$f")" command cses "$@"
  rc=$?
  d="$(cat "$f" 2>/dev/null)"; rm -f "$f"
  [ -n "$d" ] && command -v cygpath >/dev/null && d="$(cygpath -u "$d")"
  [ -n "$d" ] && [ -d "$d" ] && cd "$d"
  return $rc
}
```

PowerShell:

```powershell
function cses {
  $f = New-TemporaryFile
  $env:CSES_CD = $f.FullName
  try { & (Get-Command cses -CommandType Application | Select-Object -First 1) @args }
  finally {
    Remove-Item Env:CSES_CD
    $d = Get-Content $f -ErrorAction SilentlyContinue
    Remove-Item $f
    if ($d -and (Test-Path $d)) { Set-Location $d }
  }
}
```

## Usage

```
cses                     open the browser
cses .                   start in the current folder
cses folders             start in the folder column
cses list [N]            the last N conversations, no UI
cses accounts            detected accounts and whether they share history
cses new-account NAME    create ~/.claude-NAME sharing history and settings
cses login NAME          open claude with that account to log in
```

Anything that isn't a `cses` option is passed to `claude`: `cses --model opus`, or
`cses -- …` to pass everything through. The Spanish names (`lista`, `cuentas`,
`cuenta-nueva`, `carpetas`) work too.

| Key | Folders | Conversations | Preview |
|---|---|---|---|
| typing | search folders | search conversations | |
| `↑` `↓` `PgUp` `PgDn` | move | move | scroll |
| `→` | expand / next column | preview | |
| `←` | collapse / parent | folders | conversations |
| `↵` | show its conversations | open here | open here |
| `Ctrl+T` | new conversation in a tab | open in a new tab | |
| `Ctrl+N` | new conversation here | new conversation in its folder | |
| `Ctrl+F` | | open a fork (`--fork-session`) | |
| `Ctrl+E` | favorite folder | favorite conversation | |
| `Ctrl+G` | | go to its folder | |
| `Ctrl+A` | switch account (cycles back to automatic) | | |
| `Ctrl+Y` | | copy the session id | |
| `Ctrl+R` | refresh | refresh | refresh |
| `esc` | clear search · back · quit | | |
| `Tab` | next column | | |

With mouse reporting on, select text in the terminal with `Shift`+drag. Turn the
mouse off with `"mouse": false` in the config.

## Several accounts

Claude Code keeps each account in its own config directory (`CLAUDE_CONFIG_DIR`).
`cses` detects `~/.claude` (the "principal" one) and every `~/.claude-NAME`, and launches
`claude` with the right variable, so conversations from different accounts can run side
by side, one per tab.

`cses new-account NAME` creates the directory linking `projects/`, `skills/`, `plugins/`…
and the settings to the main one: history is shared, any conversation can be resumed
with any account, and only the credentials are separate. If an account doesn't share
`projects/`, `cses` opens its conversations with it and tells you so.

### Accounts panel: switch accounts without leaving the chat

When you have more than one account and `cses` runs in Windows Terminal or tmux, opening
a conversation splits the tab: `claude` on the left and a narrow accounts panel on the
right.

```
╭─ claude ───────────────────────────────────────╮╭─ Accounts ────────────────╮
│ ✻ You've hit your session limit · resets 6pm   ││ ⚠ Limit reached           │
│                                                ││ ● work                    │
│ >                                              ││   you@company.com         │
│                                                ││   ⚠ limit · back 18:00    │
│                                                ││                           │
│                                                ││ ○ personal                │
│                                                ││   you@gmail.com           │
│                                                ││                           │
│                                                ││ + Add account             │
╰────────────────────────────────────────────────╯╰───────────────────────────╯
```

- **Click another account** and the same conversation reopens with it, in the same pane,
  in a couple of seconds. No `/login`: each account keeps its own login. Claude Code
  can't change accounts inside a running session, so `cses` restarts it with
  `--resume`; the conversation is all there, only text you hadn't sent is lost. If
  Claude is in the middle of an answer, the panel asks first.
- **Usage limits**: when Claude says you've hit a limit, the panel marks that account
  with ⚠ and when it comes back, so you know which one to switch to.
- **+ Add account** creates `~/.claude-NAME` and opens a tab to log in, once.

Turn it off with `"accountsPanel": false`, or on with only one account with `true`.

## Configuration

`~/.cses/config.json` (optional; Spanish keys work too):

```json
{
  "roots": ["~/projects", "~/clients"],
  "defaultAccount": "principal",
  "rules": [{ "folder": "~/clients", "account": "work" }],
  "terminal": "wt",
  "language": "en",
  "mouse": true
}
```

- **`roots`**: always at the top of the tree, even without conversations.
- **`rules`**: which account to suggest for a folder (the most specific one wins).
- **`accounts`**: `[{ "name", "dir" }]` instead of auto-detection.
- **`terminal`**: `wt` (Windows Terminal, the Windows default), `window` or `tmux`.
- **`language`**: `en` or `es`. Also `CSES_LANG`, then `LANG`, then the system locale.
- **`accountsPanel`**: the accounts panel next to `claude` (on by default with two or
  more accounts).
- `CSES_CLAUDE` (environment variable): path to the `claude` executable, if it isn't the
  one in your `PATH`.

## How it works and privacy

`cses` only reads files on your machine: the conversation transcripts Claude Code writes
under `<config dir>/projects/`, and the `sessions/` files that say which ones are open.
It keeps an index in `~/.cses/indice.json` (safe to delete; it's rebuilt), your
favorites in `~/.cses/favoritos.json`, the usage limits it has seen in
`~/.cses/limites.json` and, while a conversation is open, a small file in
`~/.cses/paneles/` for the accounts panel. Nothing is sent anywhere.

## Status

Developed on Windows 11 with Windows Terminal and Git Bash. It should work on macOS and
Linux (new tabs need tmux there), but that hasn't been tested yet: reports and PRs are
very welcome.

## Contributing

Issues and pull requests are welcome, in English or Spanish. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

A fork of [ccresume](https://github.com/sasazame/ccresume) by sasazame (MIT): it keeps
its Ink/React base and character-width handling and rewrites the rest.

Not affiliated with Anthropic. "Claude" is a trademark of Anthropic.

## License

[MIT](LICENSE)
