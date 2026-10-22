import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'fs';
import { join, basename } from 'path';
import { HOME, normalizePath, isInside } from './paths.js';
import { loadConfig } from './config.js';
import { t } from '../i18n.js';

export interface Account {
  nombre: string;
  // Directorio de configuración (lo que va en CLAUDE_CONFIG_DIR)
  dir: string;
  // La de ~/.claude: se lanza sin CLAUDE_CONFIG_DIR
  principal: boolean;
  email: string | null;
  conSesion: boolean;
  // Ruta real de su projects/: dos cuentas con el mismo comparten historial
  projectsReal: string | null;
}

const DEFAULT_DIR = join(HOME, '.claude');

function readEmail(claudeJson: string): string | null {
  try {
    const data = JSON.parse(readFileSync(claudeJson, 'utf-8')) as { oauthAccount?: { emailAddress?: string } };
    return data.oauthAccount?.emailAddress ?? null;
  } catch {
    return null;
  }
}

function realOrNull(p: string): string | null {
  try {
    return normalizePath(realpathSync(p));
  } catch {
    return null;
  }
}

function describe(nombre: string, dir: string): Account {
  const principal = normalizePath(dir) === normalizePath(DEFAULT_DIR);
  // La cuenta por defecto guarda su .claude.json fuera, en la carpeta personal
  const claudeJson = principal ? join(HOME, '.claude.json') : join(dir, '.claude.json');
  const email = readEmail(claudeJson);
  return {
    nombre,
    dir,
    principal,
    email,
    conSesion: email !== null || existsSync(join(dir, '.credentials.json')),
    projectsReal: realOrNull(join(dir, 'projects')),
  };
}

function detect(): Array<{ nombre: string; dir: string }> {
  const found = [{ nombre: 'principal', dir: DEFAULT_DIR }];
  let entries: string[] = [];
  try {
    entries = readdirSync(HOME);
  } catch {
    return found;
  }
  for (const entry of entries.sort()) {
    if (!entry.startsWith('.claude-')) continue;
    const dir = join(HOME, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (existsSync(join(dir, '.claude.json')) || existsSync(join(dir, 'settings.json'))) {
      found.push({ nombre: entry.slice('.claude-'.length), dir });
    }
  }
  const fromEnv = process.env.CLAUDE_CONFIG_DIR;
  if (fromEnv && !found.some(a => normalizePath(a.dir) === normalizePath(fromEnv))) {
    found.push({ nombre: basename(fromEnv).replace(/^\.claude-?/, '') || 'entorno', dir: fromEnv });
  }
  return found;
}

let cached: Account[] | null = null;

export function getAccounts(refresh = false): Account[] {
  if (cached && !refresh) return cached;
  const configured = loadConfig().cuentas;
  cached = (configured && configured.length > 0 ? configured : detect()).map(a => describe(a.nombre, a.dir));
  return cached;
}

export function defaultAccount(accounts: Account[]): Account {
  const wanted = loadConfig().cuentaPorDefecto;
  return accounts.find(a => a.nombre === wanted) ?? accounts.find(a => a.conSesion) ?? accounts[0];
}

// La cuenta que toca para una carpeta según las reglas de la configuración
export function accountForFolder(folder: string, accounts: Account[]): Account | null {
  const rules = (loadConfig().reglas ?? [])
    .filter(r => isInside(folder, r.carpeta))
    .sort((a, b) => b.carpeta.length - a.carpeta.length);
  for (const rule of rules) {
    const account = accounts.find(a => a.nombre === rule.cuenta);
    if (account) return account;
  }
  return null;
}

// Entorno con el que se lanza claude para una cuenta
export function envFor(account: Account): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (account.principal) {
    delete env.CLAUDE_CONFIG_DIR;
  } else {
    env.CLAUDE_CONFIG_DIR = account.dir;
  }
  return env;
}

export function accountLabel(account: Account): string {
  return account.email ? `${account.nombre} · ${account.email}` : `${account.nombre} · ${t('accountNoSession')}`;
}
