import { homedir } from 'os';
import { join, sep, resolve } from 'path';

export const HOME = homedir();
// Funciones y no constantes: así CSES_DIR se puede cambiar en las pruebas
export const csesDir = () => process.env.CSES_DIR || join(HOME, '.cses');
export const configFile = () => join(csesDir(), 'config.json');
export const indexFile = () => join(csesDir(), 'indice.json');
export const IS_WINDOWS = process.platform === 'win32';

// Windows no distingue mayúsculas en las rutas: Claude guarda a veces «c:\…» y a veces «C:\…»
export function normalizePath(p: string): string {
  const r = resolve(p);
  return IS_WINDOWS ? r.toLowerCase() : r;
}

export function isInside(child: string, parent: string): boolean {
  const c = normalizePath(child);
  const p = normalizePath(parent);
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

export function expandHome(p: string): string {
  if (p === '~') return HOME;
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(HOME, p.slice(2));
  return p;
}

// Ruta para mostrar: relativa a la carpeta personal y con «/»
export function shortPath(p: string): string {
  const fwd = p.replace(/\\/g, '/');
  const home = HOME.replace(/\\/g, '/');
  const same = IS_WINDOWS ? fwd.toLowerCase() === home.toLowerCase() : fwd === home;
  if (same) return '~';
  const prefix = home + '/';
  const inHome = IS_WINDOWS ? fwd.toLowerCase().startsWith(prefix.toLowerCase()) : fwd.startsWith(prefix);
  return inHome ? fwd.slice(prefix.length) : fwd;
}

export function lastSegment(p: string): string {
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
