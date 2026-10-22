import { spawn, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { Account } from './accounts.js';
import { envFor } from './accounts.js';
import { loadConfig } from './config.js';
import { IS_WINDOWS } from './paths.js';
import { t } from '../i18n.js';

export interface LaunchRequest {
  cwd: string;
  account: Account;
  sessionId?: string;
  fork?: boolean;
  extraArgs: string[];
  titulo: string;
}

export function which(cmd: string): string | null {
  const r = spawnSync(IS_WINDOWS ? 'where' : 'which', [cmd], { encoding: 'utf-8' });
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).find(Boolean) ?? null;
}

// En Windows, el claude de npm es un .cmd que solo llama a claude.exe. Lanzar el .exe
// directamente evita pasar por cmd.exe, que es lo que dejaba la consola sin entrada
let claudeBin: { cmd: string; shell: boolean } | null = null;

export function resolveClaude(): { cmd: string; shell: boolean } {
  if (claudeBin) return claudeBin;
  // Para otra instalación de claude, o para las pruebas
  const custom = process.env.CSES_CLAUDE;
  if (custom) return (claudeBin = { cmd: custom, shell: /\.(cmd|bat)$/i.test(custom) });
  if (!IS_WINDOWS) return (claudeBin = { cmd: 'claude', shell: false });
  const exe = which('claude.exe');
  if (exe) return (claudeBin = { cmd: exe, shell: false });
  const shim = which('claude.cmd');
  if (shim) {
    const match = /"%dp0%\\([^"]+\.exe)"/i.exec(readFileSync(shim, 'utf-8'));
    const target = match ? join(dirname(shim), match[1]) : null;
    if (target && existsSync(target)) return (claudeBin = { cmd: target, shell: false });
  }
  return (claudeBin = { cmd: 'claude', shell: true });
}

export function claudeArgs(req: LaunchRequest): string[] {
  const args = [...req.extraArgs];
  if (req.sessionId) args.push('--resume', req.sessionId);
  if (req.fork) args.push('--fork-session');
  return args;
}

// Que la shell que llamó a cses acabe en la carpeta de la conversación (ver README)
export function rememberCwd(cwd: string) {
  if (!process.env.CSES_CD) return;
  try {
    writeFileSync(process.env.CSES_CD, cwd);
  } catch {
    // Sin el fichero, simplemente no se cambia de carpeta
  }
}

// Ejecuta claude en esta misma terminal y devuelve su código de salida
export function runHere(req: LaunchRequest): Promise<number> {
  const bin = resolveClaude();
  rememberCwd(req.cwd);
  return new Promise(resolve => {
    const child = spawn(bin.cmd, claudeArgs(req), { cwd: req.cwd, env: envFor(req.account), stdio: 'inherit', shell: bin.shell });
    // Ctrl+C es para claude, no para cses, que solo espera
    const ignore = () => {};
    process.on('SIGINT', ignore);
    child.on('error', err => {
      process.off('SIGINT', ignore);
      process.stderr.write(`${t('cliLaunchFailed', { msg: err.message })}\n`);
      resolve(1);
    });
    child.on('close', code => {
      process.off('SIGINT', ignore);
      resolve(code ?? 0);
    });
  });
}

function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function powershellCommand(req: LaunchRequest, command?: string[]): string {
  if (command) return `& ${command.map(psQuote).join(' ')}`;
  const envLine = req.account.principal
    ? 'Remove-Item Env:CLAUDE_CONFIG_DIR -ErrorAction SilentlyContinue'
    : `$env:CLAUDE_CONFIG_DIR = ${psQuote(req.account.dir)}`;
  const bin = resolveClaude();
  return `${envLine}; & ${psQuote(bin.cmd)} ${claudeArgs(req).map(psQuote).join(' ')}`;
}

// error null: no hay terminal en la que abrir pestañas
export type TabResult =
  | { ok: true; donde: 'pestana' | 'ventana' | 'tmux' }
  | { ok: false; error: string | null };

export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// Abre claude en una pestaña nueva; cses sigue abierto para lanzar más. Con «command»,
// lo que se ejecuta en la pestaña es eso (cses _run, que pone el panel de cuentas)
export function runInNewTab(req: LaunchRequest, command?: string[]): TabResult {
  const mode = loadConfig().terminal ?? (IS_WINDOWS ? 'wt' : process.env.TMUX ? 'tmux' : 'ventana');
  try {
    if (IS_WINDOWS) {
      const shell = which('pwsh.exe') ?? 'powershell.exe';
      // -EncodedCommand evita pelearse con las comillas y con el «;», que wt usa de separador
      const encoded = Buffer.from(powershellCommand(req, command), 'utf16le').toString('base64');
      const psArgs = ['-NoExit', '-EncodedCommand', encoded];
      const wt = mode === 'wt' ? which('wt.exe') : null;
      if (wt) {
        const title = req.titulo.replace(/[;"]/g, ' ').slice(0, 40);
        spawn(wt, ['-w', '0', 'new-tab', '--title', title, '--suppressApplicationTitle', '-d', req.cwd, shell, ...psArgs], {
          detached: true, stdio: 'ignore',
        }).unref();
        return { ok: true, donde: 'pestana' };
      }
      // En Windows, «detached» le da al proceso su propia consola
      spawn(shell, psArgs, { cwd: req.cwd, detached: true, stdio: 'ignore' }).unref();
      return { ok: true, donde: 'ventana' };
    }
    if (mode === 'tmux' && process.env.TMUX) {
      const env = envFor(req.account);
      const prefix = env.CLAUDE_CONFIG_DIR ? `CLAUDE_CONFIG_DIR='${env.CLAUDE_CONFIG_DIR}' ` : 'env -u CLAUDE_CONFIG_DIR ';
      const line = command ? command.map(shQuote).join(' ') : `${prefix}claude ${claudeArgs(req).join(' ')}`;
      spawn('tmux', ['new-window', '-c', req.cwd, '-n', req.titulo.slice(0, 20), line], {
        detached: true, stdio: 'ignore',
      }).unref();
      return { ok: true, donde: 'tmux' };
    }
    return { ok: false, error: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
