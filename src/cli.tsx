#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import App, { CONVS, FOLDERS } from './App.js';
import Panel from './Panel.js';
import Setup from './Setup.js';
import type { SetupAction } from './Setup.js';
import { accountLabel, getAccounts } from './core/accounts.js';
import { createAccount } from './core/accountAdmin.js';
import { loadConfig } from './core/config.js';
import { titleOf, updateIndex, visibleSessions } from './core/indexer.js';
import { runningSessions } from './core/running.js';
import type { LaunchRequest } from './core/launcher.js';
import { runAuth } from './core/launcher.js';
import { decodeSpec, runWithPanel } from './core/supervisor.js';
import { shortDate } from './core/format.js';
import { isInside, shortPath } from './core/paths.js';
import { setLang, t } from './i18n.js';
import { FilteredInput } from './ui/input.js';
import { fit, fitLeft } from './ui/text.js';

// Cada subcomando se puede escribir en castellano o en inglés
const SUBCOMMANDS: Record<string, string> = {
  carpetas: 'carpetas', folders: 'carpetas',
  lista: 'lista', list: 'lista',
  cuentas: 'cuentas', accounts: 'cuentas',
  'cuenta-nueva': 'cuenta-nueva', 'new-account': 'cuenta-nueva',
  login: 'login',
  config: 'config', configurar: 'config', setup: 'config',
  // Internos: los usa cses para abrir el panel de cuentas y las pestañas nuevas
  _panel: '_panel',
  _run: '_run',
};

const config = loadConfig();
if (config.idioma) setLang(config.idioma);

const argv = process.argv.slice(2);
const dashdash = argv.indexOf('--');
const own = dashdash === -1 ? argv : argv.slice(0, dashdash);
const passthrough = dashdash === -1 ? [] : argv.slice(dashdash + 1);

if (own.includes('-h') || own.includes('--help')) {
  console.log(t('help'));
  process.exit(0);
}
if (own.includes('-v') || own.includes('--version')) {
  const here = dirname(fileURLToPath(import.meta.url));
  console.log(JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf-8')).version);
  process.exit(0);
}

// El subcomando, si lo hay, va el primero; «.» puede ir en cualquier sitio
const firstArg = own.find(a => a !== '.');
const command = firstArg && firstArg in SUBCOMMANDS ? SUBCOMMANDS[firstArg] : null;
const rest = own.filter(a => a !== '.');
if (command && firstArg) rest.splice(rest.indexOf(firstArg), 1);
const currentDirOnly = own.includes('.');
const takesArgs = command === 'lista' || command === 'cuenta-nueva' || command === 'login' || command === '_panel' || command === '_run';
const commandArgs = takesArgs ? rest.filter(a => !a.startsWith('-')) : [];
// Todo lo demás es para claude (como hacía ccresume), con sus valores: «--model opus»
const claudeArgs = [...(takesArgs ? rest.filter(a => a.startsWith('-')) : rest), ...passthrough];

// Pantalla completa para Ink, con el ratón aparte; al terminar deja la terminal como estaba
async function fullScreen(build: (mouse: FilteredInput['mouse'] | null) => React.ReactElement): Promise<void> {
  const input = new FilteredInput(process.stdin);
  const withMouse = loadConfig().raton !== false;
  const restoreTerminal = () => {
    input.disableMouse();
    process.stdout.write('\x1b[?1049l\x1b[?25h');
  };
  // Pantalla alternativa: al salir, la terminal queda como estaba
  process.stdout.write('\x1b[?1049h\x1b[H\x1b[?25l');
  if (withMouse) input.enableMouse();
  process.on('exit', restoreTerminal);
  const app = render(build(withMouse ? input.mouse : null), { exitOnCtrlC: false, stdin: input as unknown as NodeJS.ReadStream });
  await app.waitUntilExit();
  app.cleanup();
  restoreTerminal();
  process.off('exit', restoreTerminal);
  // Que cses suelte la entrada antes de dársela a claude
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  input.dispose();
}

// Cuentas y preferencias. Para iniciar o cerrar sesión se sale de la pantalla, se ejecuta
// «claude auth» aquí mismo y se vuelve
async function setupScreen(welcome: boolean): Promise<void> {
  let first = welcome;
  for (;;) {
    let action: SetupAction | null = null;
    await fullScreen(mouse => (
      <Setup welcome={first} mouse={mouse} onAction={a => {
        action = a;
      }} />
    ));
    first = false;
    const a = action as SetupAction | null;
    if (!a) return;
    const account = getAccounts(true).find(x => x.nombre === a.cuenta);
    if (!account) continue;
    if (a.kind === 'login') {
      console.log(`\x1b[38;2;217;119;87m✻\x1b[0m ${t('setupLoggingIn', { name: account.nombre, dir: account.dir })}`);
      console.log(`\x1b[2m  ${t('setupLoggingInHint', { name: account.nombre })}\x1b[0m\n`);
    } else {
      console.log(t('setupLoggingOut', { name: account.nombre }));
    }
    await runAuth(account, a.kind);
  }
}

async function main(): Promise<number> {
  if (command === 'config') {
    if (!process.stdin.isTTY) {
      console.error(t('cliNeedsTty'));
      return 2;
    }
    await setupScreen(!loadConfig().configurado);
    return 0;
  }

  if (command === '_panel') {
    if (!commandArgs[0] || !process.stdin.isTTY) return 2;
    await fullScreen(mouse => <Panel id={commandArgs[0]} mouse={mouse} />);
    return 0;
  }

  if (command === '_run') {
    const req = commandArgs[0] ? decodeSpec(commandArgs[0]) : null;
    if (!req) return 2;
    return runWithPanel(req, getAccounts());
  }

  if (command === 'cuentas') {
    const accounts = getAccounts();
    for (const a of accounts) {
      const shared = accounts.filter(b => b !== a && b.projectsReal && b.projectsReal === a.projectsReal).map(b => b.nombre);
      console.log(`${a.conSesion ? '●' : '○'} ${accountLabel(a)}`);
      console.log(`    ${a.dir}${shared.length ? `   (${t('cliShared', { names: shared.join(', ') })})` : ''}`);
    }
    return 0;
  }

  if (command === 'cuenta-nueva') {
    const nombre = commandArgs[0];
    if (!nombre) {
      console.error(t('cliNewAccountUsage'));
      return 2;
    }
    try {
      for (const l of createAccount(nombre)) console.log(l);
      console.log(`\n${t('cliNewAccountNext', { name: nombre })}`);
      return 0;
    } catch (err) {
      console.error(`cses: ${(err as Error).message}`);
      return 1;
    }
  }

  if (command === 'login') {
    const account = getAccounts().find(a => a.nombre === commandArgs[0]);
    if (!account) {
      console.error(t('cliNoAccount', { name: commandArgs[0] ?? '' }));
      return 2;
    }
    console.log(`${t('cliLogin', { name: account.nombre, dir: account.dir })}\n`);
    return runAuth(account, 'login');
  }

  if (command === 'lista') {
    const n = Number(commandArgs[0] ?? 20) || 20;
    const accounts = getAccounts();
    const sessions = visibleSessions(await updateIndex(accounts))
      .filter(s => !currentDirOnly || (s.cwd && isInside(s.cwd, process.cwd())));
    const running = runningSessions(accounts);
    const width = process.stdout.columns || 120;
    const titleW = Math.max(20, width - 8 - 30 - 12);
    for (const s of sessions.slice(0, n)) {
      console.log(`${running.has(s.id) ? '●' : ' '} ${fit(shortDate(s.mtime), 9, 'right')}  ${fitLeft(shortPath(s.cwd ?? ''), 28)}  ${fit(titleOf(s), titleW)}  ${s.id.slice(0, 8)}`);
    }
    return 0;
  }

  // ── Interfaz ─────────────────────────────────────────────────────────
  if (!process.stdin.isTTY) {
    console.error(t('cliNeedsTty'));
    return 2;
  }
  // La primera vez, antes del navegador, la configuración
  if (!loadConfig().configurado) await setupScreen(true);
  let launchRequest: LaunchRequest | null = null;
  for (;;) {
    let toConfig = false;
    await fullScreen(mouse => (
      <App
        extraArgs={claudeArgs}
        initialFolder={currentDirOnly ? process.cwd() : null}
        initialFocus={command === 'carpetas' ? FOLDERS : CONVS}
        mouse={mouse}
        onLaunch={req => {
          launchRequest = req;
        }}
        onConfig={() => {
          toConfig = true;
        }}
      />
    ));
    if (!toConfig) break;
    await setupScreen(false);
  }

  const req = launchRequest as LaunchRequest | null;
  if (!req) return 0;
  const what = req.sessionId ? (req.fork ? t('cliForking') : t('cliResuming')) : t('cliNewIn');
  console.log(`\x1b[38;2;217;119;87m✻\x1b[0m ${what} ${req.sessionId ? `«${req.titulo}»` : shortPath(req.cwd)}`);
  console.log(`\x1b[2m  ${req.cwd} · ${t('cliAccount')} ${req.account.nombre}\x1b[0m\n`);
  return runWithPanel(req, getAccounts());
}

main().then(code => process.exit(code), err => {
  process.stdout.write('\x1b[?1000l\x1b[?1006l\x1b[?1049l\x1b[?25h');
  console.error(err);
  process.exit(1);
});
