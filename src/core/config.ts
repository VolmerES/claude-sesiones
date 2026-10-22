import { readFileSync } from 'fs';
import { configFile, expandHome } from './paths.js';
import type { Lang } from '../i18n.js';

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
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      process.stderr.write(`cses: ${configFile()}: ${(err as Error).message}\n`);
    }
    cached = {};
  }
  return cached;
}
