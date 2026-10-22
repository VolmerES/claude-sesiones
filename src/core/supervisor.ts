import { spawn, spawnSync } from 'child_process';
import { resolve } from 'path';
import type { Account } from './accounts.js';
import { envFor, getAccounts } from './accounts.js';
import { loadConfig } from './config.js';
import type { LaunchRequest } from './launcher.js';
import { claudeArgs, rememberCwd, resolveClaude, shQuote, which } from './launcher.js';
import type { PanelState } from './panelLink.js';
import { newPanelId, prunePanels, removePanel, takeOrder, writeState } from './panelLink.js';
import { IS_WINDOWS, csesDir } from './paths.js';
import { debug } from './debug.js';
import { alive, sessionOfPid } from './running.js';
import { t } from '../i18n.js';

// Columnas que ocupa el panel de cuentas
const PANEL_COLS = 30;

// Cómo volver a llamar a cses (sirve también con tsx, que va en execArgv)
export function csesCommand(args: string[]): string[] {
  return [process.execPath, ...process.execArgv, resolve(process.argv[1]), ...args];
}

// Lo que necesita «cses _run» para abrir una conversación en otra pestaña
export interface RunSpec {
  cwd: string;
  cuenta: string;
  sessionId?: string;
  fork?: boolean;
  extraArgs: string[];
  titulo: string;
}

export const encodeSpec = (req: LaunchRequest): string =>
  Buffer.from(JSON.stringify({ ...req, account: undefined, cuenta: req.account.nombre } satisfies RunSpec & { account?: undefined })).toString('base64url');

export function decodeSpec(encoded: string): LaunchRequest | null {
  try {
    const spec = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as RunSpec;
    const account = getAccounts().find(a => a.nombre === spec.cuenta);
    if (!account) return null;
    return { cwd: spec.cwd, account, sessionId: spec.sessionId, fork: spec.fork, extraArgs: spec.extraArgs ?? [], titulo: spec.titulo };
  } catch {
    return null;
  }
}

// Se puede poner un panel al lado: Windows Terminal o tmux
function splitter(): 'wt' | 'tmux' | null {
  if (IS_WINDOWS && process.env.WT_SESSION && which('wt.exe')) return 'wt';
  if (process.env.TMUX) return 'tmux';
  return null;
}

// Por defecto, en cuanto hay más de una cuenta
const panelAsked = (accounts: Account[]) => loadConfig().panelCuentas ?? accounts.length > 1;

export function panelWanted(accounts: Account[]): boolean {
  return panelAsked(accounts) && splitter() !== null;
}

// El panel lo lanza Windows Terminal (o tmux) con su propio entorno, no con el de cses:
// lo que el panel necesita del entorno va en los argumentos
export function panelArgs(id: string): string[] {
  return ['_panel', id, `--dir=${csesDir()}`, ...(process.env.CSES_DEBUG ? ['--debug'] : [])];
}

// Abre el panel de cuentas a la derecha sin quitarle el foco a claude
export function openPanel(id: string, cwd: string): boolean {
  const cmd = csesCommand(panelArgs(id));
  try {
    if (splitter() === 'wt') {
      const cols = process.stdout.columns || 120;
      const size = Math.min(0.4, Math.max(0.15, PANEL_COLS / cols)).toFixed(2);
      spawn(which('wt.exe') as string, [
        '-w', '0', 'split-pane', '-V', '-s', size, '--title', t('panelTitle'), '--suppressApplicationTitle', '-d', cwd, ...cmd,
        ';', 'move-focus', 'left',
      ], { detached: true, stdio: 'ignore' }).unref();
      return true;
    }
    if (splitter() === 'tmux') {
      const r = spawnSync('tmux', ['split-window', '-h', '-d', '-l', String(PANEL_COLS), '-c', cwd, cmd.map(shQuote).join(' ')]);
      return r.status === 0;
    }
  } catch {
    // Sin panel se sigue igual, solo que sin poder cambiar de cuenta con un clic
  }
  return false;
}

// Al hacer clic en el panel, el teclado se queda en él: se le devuelve a claude
export function focusClaude() {
  try {
    if (splitter() === 'wt') spawn(which('wt.exe') as string, ['-w', '0', 'move-focus', 'left'], { detached: true, stdio: 'ignore' }).unref();
    else if (splitter() === 'tmux') spawnSync('tmux', ['select-pane', '-L']);
  } catch {
    // Solo es comodidad
  }
}

// Deja la terminal como la encontró claude por si se le cortó a medias
function resetTerminal() {
  process.stdout.write(
    '\x1b[0m\x1b[?25h\x1b[?2004l\x1b[?1004l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[<u\x1b[?1049l\x1b[2J\x1b[3J\x1b[H',
  );
}

function killTree(pid: number) {
  if (IS_WINDOWS) {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Ya había terminado
    }
  }
}

/**
 * Ejecuta claude en esta terminal y, cada vez que el panel pide otra cuenta, lo cierra y
 * retoma la misma conversación con ella. Termina cuando claude termina por sí solo.
 */
export async function runSupervised(first: LaunchRequest, id = newPanelId()): Promise<number> {
  const bin = resolveClaude();
  const historial: PanelState['historial'] = [];
  let req = first;
  rememberCwd(req.cwd);
  prunePanels(alive);
  // Ctrl+C es para claude, no para cses, que solo espera
  const ignore = () => {};
  process.on('SIGINT', ignore);
  try {
    for (;;) {
      historial.push({ cuenta: req.account.nombre, desde: Date.now() });
      const child = spawn(bin.cmd, claudeArgs(req), { cwd: req.cwd, env: envFor(req.account), stdio: 'inherit', shell: bin.shell });
      const state: PanelState = {
        supervisor: process.pid,
        claudePid: child.pid ?? null,
        cuenta: req.account.nombre,
        cwd: req.cwd,
        sessionId: req.fork ? null : req.sessionId ?? null,
        titulo: req.titulo,
        historial,
      };
      writeState(id, state);
      debug('supervisor', 'claude lanzado', { id, cuenta: state.cuenta, claudePid: state.claudePid, sessionId: state.sessionId });

      let next: Account | null = null;
      const current = req.account;
      const timer = setInterval(() => {
        const order = takeOrder(id);
        if (!order || order.cuenta === current.nombre || !child.pid) return;
        next = getAccounts(true).find(a => a.nombre === order.cuenta) ?? null;
        if (next) killTree(child.pid);
      }, 300);

      const code = await new Promise<number>(done => {
        child.on('error', err => {
          process.stderr.write(`${t('cliLaunchFailed', { msg: err.message })}\n`);
          done(1);
        });
        child.on('close', c => done(c ?? 0));
      });
      clearInterval(timer);
      debug('supervisor', 'claude terminó', { code, cambiarA: (next as Account | null)?.nombre ?? null });

      const target = next as Account | null;
      if (!target) return code;
      // La conversación que tenía abierta (pudo cambiar con /resume o /clear)
      const sessionId = (child.pid ? sessionOfPid(current, child.pid)?.sessionId : null) ?? state.sessionId ?? undefined;
      resetTerminal();
      process.stdout.write(`\x1b[38;2;217;119;87m✻\x1b[0m ${t('cliSwitching', { name: target.nombre })}\n\n`);
      req = { ...req, account: target, sessionId, fork: false };
    }
  } finally {
    process.off('SIGINT', ignore);
    removePanel(id);
  }
}

// Abre claude aquí, con el panel de cuentas al lado si se puede
export function runWithPanel(req: LaunchRequest, accounts: Account[]): Promise<number> {
  const where = splitter();
  debug('supervisor', 'entorno', { pedido: panelAsked(accounts), donde: where, WT_SESSION: Boolean(process.env.WT_SESSION), TMUX: Boolean(process.env.TMUX) });
  if (!panelWanted(accounts)) {
    // Que no parezca que el panel falla: si toca y no se puede, se dice
    if (panelAsked(accounts) && loadConfig().panelCuentas !== false) {
      process.stdout.write(`\x1b[2m  ${t('panelUnavailable')}\x1b[0m\n\n`);
    }
    return runSupervised(req);
  }
  const id = newPanelId();
  const opened = openPanel(id, req.cwd);
  debug('supervisor', 'panel', { id, opened, cmd: csesCommand(panelArgs(id)) });
  return runSupervised(req, id);
}
