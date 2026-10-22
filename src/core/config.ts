import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { configFile, expandHome, tildePath } from './paths.js';
import type { Lang } from '../i18n.js';
import { getLang } from '../i18n.js';

export interface AccountConfig {
  nombre: string;
  dir: string;
}

export interface FolderRule {
  carpeta: string;
  cuenta: string;
}

export interface CcsConfig {
  // Si falta, se detectan solas: ~/.claude y cada ~/.claude-<nombre>
  cuentas?: AccountConfig[];
  cuentaPorDefecto?: string;
  // Qué cuenta se propone según la carpeta de la conversación (gana la regla más larga)
  reglas?: FolderRule[];
  // Carpetas que salen arriba del árbol aunque no tengan conversaciones
  raices?: string[];
  // Cómo se abre una pestaña nueva: wt (Windows Terminal), ventana o tmux
  terminal?: 'wt' | 'ventana' | 'tmux';
  // Si falta, el del sistema
  idioma?: Lang;
  // Ratón en la interfaz (sí por defecto)
  raton?: boolean;
  // Panel de cuentas al lado de claude (por defecto, si hay más de una cuenta)
  panelCuentas?: boolean;
  // Ya se pasó por la configuración inicial
  configurado?: boolean;
}

// El fichero admite las claves en castellano o en inglés
interface RawConfig extends CcsConfig {
  accounts?: Array<{ name: string; dir: string }>;
  defaultAccount?: string;
  rules?: Array<{ folder: string; account: string }>;
  roots?: string[];
  language?: Lang;
  mouse?: boolean;
  accountsPanel?: boolean;
  configured?: boolean;
}

let cached: CcsConfig | null = null;

export function loadConfig(): CcsConfig {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(configFile(), 'utf-8')) as RawConfig;
    const cuentas = raw.cuentas ?? raw.accounts?.map(a => ({ nombre: a.name, dir: a.dir }));
    const reglas = raw.reglas ?? raw.rules?.map(r => ({ carpeta: r.folder, cuenta: r.account }));
    cached = {
      cuentas: cuentas?.map(c => ({ ...c, dir: expandHome(c.dir) })),
      cuentaPorDefecto: raw.cuentaPorDefecto ?? raw.defaultAccount,
      reglas: reglas?.map(r => ({ ...r, carpeta: expandHome(r.carpeta) })),
      raices: (raw.raices ?? raw.roots)?.map(expandHome),
      terminal: raw.terminal === ('window' as string) ? 'ventana' : raw.terminal,
      idioma: raw.idioma ?? raw.language,
      raton: raw.raton ?? raw.mouse,
      panelCuentas: raw.panelCuentas ?? raw.accountsPanel,
      configurado: raw.configurado ?? raw.configured,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      process.stderr.write(`cses: ${configFile()}: ${(err as Error).message}\n`);
    }
    cached = {};
  }
  return cached;
}

export function configExists(): boolean {
  try {
    readFileSync(configFile());
    return true;
  } catch {
    return false;
  }
}

// Guarda la configuración con las claves en el idioma de la interfaz y las rutas con «~»
export function saveConfig(config: CcsConfig) {
  const en = getLang() === 'en';
  const paths = (list?: string[]) => list?.map(tildePath);
  const raw: Record<string, unknown> = en
    ? {
        configured: config.configurado,
        defaultAccount: config.cuentaPorDefecto,
        roots: paths(config.raices),
        rules: config.reglas?.map(r => ({ folder: tildePath(r.carpeta), account: r.cuenta })),
        accounts: config.cuentas?.map(c => ({ name: c.nombre, dir: tildePath(c.dir) })),
        terminal: config.terminal === 'ventana' ? 'window' : config.terminal,
        language: config.idioma,
        mouse: config.raton,
        accountsPanel: config.panelCuentas,
      }
    : {
        configurado: config.configurado,
        cuentaPorDefecto: config.cuentaPorDefecto,
        raices: paths(config.raices),
        reglas: config.reglas?.map(r => ({ carpeta: tildePath(r.carpeta), cuenta: r.cuenta })),
        cuentas: config.cuentas?.map(c => ({ nombre: c.nombre, dir: tildePath(c.dir) })),
        terminal: config.terminal,
        idioma: config.idioma,
        raton: config.raton,
        panelCuentas: config.panelCuentas,
      };
  // Lo que no se ha tocado no se escribe
  for (const k of Object.keys(raw)) if (raw[k] === undefined) delete raw[k];
  mkdirSync(dirname(configFile()), { recursive: true });
  writeFileSync(configFile(), `${JSON.stringify(raw, null, 2)}\n`);
  cached = { ...config };
}

// Olvida lo leído: la próxima vez se lee del fichero
export function reloadConfig(): CcsConfig {
  cached = null;
  return loadConfig();
}
