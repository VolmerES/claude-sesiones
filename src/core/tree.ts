import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { dirname, join, parse, relative, sep } from 'path';
import type { SessionRecord } from './indexer.js';
import { HOME, isInside, normalizePath, lastSegment, shortPath } from './paths.js';
import { matchesQuery } from './format.js';
import { t } from '../i18n.js';

export interface FolderStats {
  conversaciones: number;
  ultima: number;
}

export interface FolderIndex {
  // Conversaciones en cada carpeta contando sus subcarpetas (clave: ruta normalizada)
  stats: Map<string, FolderStats>;
  // Subcarpetas con conversaciones de cada carpeta
  hijos: Map<string, Map<string, string>>;
  // Carpetas en las que se ha abierto claude
  cwds: Map<string, string>;
}

export type TreeRow =
  | { kind: 'grupo'; label: string }
  | { kind: 'todas'; key: string; conversaciones: number; ultima: number }
  | {
      kind: 'carpeta';
      key: string;
      path: string;
      label: string;
      depth: number;
      // Solo las conversaciones de esa carpeta, no las de dentro (la carpeta personal)
      exact: boolean;
      conversaciones: number;
      ultima: number;
      existe: boolean;
      expandible: boolean;
      expandido: boolean;
      favorito: boolean;
      // Dónde está, en gris detrás del nombre (en los resultados de búsqueda)
      detalle?: string;
    };

export type FolderRow = Extract<TreeRow, { kind: 'carpeta' }>;

export const TODAS = 'todas';
const SKIP_DIRS = new Set(['node_modules', '__pycache__', 'dist', 'build', 'target', 'vendor', 'venv']);

export const folderKey = (path: string, prefix = 'c') => `${prefix}:${normalizePath(path)}`;

export function buildFolderIndex(sessions: SessionRecord[]): FolderIndex {
  const stats = new Map<string, FolderStats>();
  const hijos = new Map<string, Map<string, string>>();
  const cwds = new Map<string, string>();
  for (const s of sessions) {
    if (!s.cwd) continue;
    cwds.set(normalizePath(s.cwd), s.cwd);
    let p = s.cwd;
    for (;;) {
      const key = normalizePath(p);
      const st = stats.get(key) ?? { conversaciones: 0, ultima: 0 };
      st.conversaciones++;
      st.ultima = Math.max(st.ultima, s.mtime);
      stats.set(key, st);
      const up = dirname(p);
      if (up === p) break;
      const upKey = normalizePath(up);
      if (!hijos.has(upKey)) hijos.set(upKey, new Map());
      (hijos.get(upKey) as Map<string, string>).set(key, p);
      p = up;
    }
  }
  return { stats, hijos, cwds };
}

// Lectura del disco cacheada: el árbol se repinta mucho y las carpetas cambian poco
const subdirCache = new Map<string, string[]>();

export function clearSubdirCache() {
  subdirCache.clear();
}

export function subdirs(path: string): string[] {
  const key = normalizePath(path);
  const cached = subdirCache.get(key);
  if (cached) return cached;
  let names: string[] = [];
  try {
    names = readdirSync(path);
  } catch {
    // Sin permiso o borrada
  }
  const dirs = names
    .filter(n => !n.startsWith('.') && !n.startsWith('$') && !SKIP_DIRS.has(n))
    .map(n => join(path, n))
    .filter(p => {
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    });
  subdirCache.set(key, dirs);
  return dirs;
}

const statsOf = (idx: FolderIndex, path: string): FolderStats =>
  idx.stats.get(normalizePath(path)) ?? { conversaciones: 0, ultima: 0 };

// Primero las que tienen conversaciones, de la más reciente a la más antigua; luego el resto por nombre
function sortFolders(paths: string[], idx: FolderIndex): string[] {
  return paths.sort((a, b) => {
    const sa = statsOf(idx, a);
    const sb = statsOf(idx, b);
    return sb.ultima - sa.ultima || lastSegment(a).localeCompare(lastSegment(b), 'es', { sensitivity: 'base' });
  });
}

export function childFolders(path: string, idx: FolderIndex): string[] {
  const byKey = new Map<string, string>();
  for (const d of subdirs(path)) byKey.set(normalizePath(d), d);
  // Las que tienen conversaciones salen aunque ya no existan
  for (const [k, p] of idx.hijos.get(normalizePath(path)) ?? []) if (!byKey.has(k)) byKey.set(k, p);
  return sortFolders([...byKey.values()], idx);
}

function firstLevel(path: string): string {
  if (isInside(path, HOME)) {
    const first = relative(HOME, path).split(sep)[0];
    return join(HOME, first);
  }
  const { root } = parse(path);
  const first = path.slice(root.length).split(sep)[0];
  return first ? join(root, first) : root;
}

// Carpetas de arriba del árbol: las raíces configuradas y donde haya conversaciones fuera de ellas
export function topLevelFolders(idx: FolderIndex, raices: string[]): { tops: string[]; enCasa: boolean } {
  const tops = new Map<string, string>();
  for (const r of raices) if (existsSync(r)) tops.set(normalizePath(r), r);
  let enCasa = false;
  for (const cwd of idx.cwds.values()) {
    if (normalizePath(cwd) === normalizePath(HOME)) {
      enCasa = true;
      continue;
    }
    if (raices.some(r => isInside(cwd, r))) continue;
    const top = firstLevel(cwd);
    tops.set(normalizePath(top), top);
  }
  return { tops: sortFolders([...tops.values()], idx), enCasa };
}

function folderRow(path: string, depth: number, idx: FolderIndex, expanded: Set<string>, favs: Set<string>, opts: {
  key?: string; label?: string; exact?: boolean; expandible?: boolean; detalle?: string;
} = {}): FolderRow {
  const key = opts.key ?? folderKey(path);
  const st = opts.exact ? { conversaciones: countExact(idx, path), ultima: statsOf(idx, path).ultima } : statsOf(idx, path);
  const expandible = opts.expandible ?? childFolders(path, idx).length > 0;
  return {
    kind: 'carpeta',
    key,
    path,
    label: opts.label ?? (depth === 0 ? shortPath(path) : lastSegment(path)),
    depth,
    exact: opts.exact ?? false,
    conversaciones: st.conversaciones,
    ultima: st.ultima,
    existe: existsSync(path),
    expandible,
    expandido: expandible && expanded.has(normalizePath(path)),
    favorito: favs.has(normalizePath(path)),
    detalle: opts.detalle,
  };
}

function countExact(idx: FolderIndex, path: string): number {
  const all = statsOf(idx, path).conversaciones;
  let inside = 0;
  for (const child of idx.hijos.get(normalizePath(path))?.values() ?? []) inside += statsOf(idx, child).conversaciones;
  return all - inside;
}

export function buildTree(idx: FolderIndex, raices: string[], expanded: Set<string>, favoritas: string[], total: number): TreeRow[] {
  const favs = new Set(favoritas.map(normalizePath));
  const rows: TreeRow[] = [{ kind: 'todas', key: TODAS, conversaciones: total, ultima: 0 }];
  if (favoritas.length) {
    rows.push({ kind: 'grupo', label: '★ Favoritas' });
    for (const f of favoritas) rows.push(folderRow(f, 0, idx, expanded, favs, { key: folderKey(f, 'f'), label: shortPath(f), expandible: false }));
    rows.push({ kind: 'grupo', label: 'Carpetas' });
  }
  const { tops, enCasa } = topLevelFolders(idx, raices);
  const push = (path: string, depth: number) => {
    const row = folderRow(path, depth, idx, expanded, favs);
    rows.push(row);
    if (row.expandido) for (const child of childFolders(path, idx)) push(child, depth + 1);
  };
  for (const top of tops) push(top, 0);
  if (enCasa) rows.push(folderRow(HOME, 0, idx, expanded, favs, { key: folderKey(HOME, 'h'), label: t('homeFolder'), exact: true, expandible: false }));
  return rows;
}

// Al buscar, el árbol se aplana: todas las carpetas conocidas que coincidan
export function searchFolders(idx: FolderIndex, raices: string[], query: string, favoritas: string[]): TreeRow[] {
  const favs = new Set(favoritas.map(normalizePath));
  const all = new Map<string, string>();
  for (const [k, p] of idx.cwds) all.set(k, p);
  for (const r of raices) for (const d of subdirs(r)) all.set(normalizePath(d), d);
  const matches = sortFolders([...all.values()].filter(p => matchesQuery(shortPath(p), query)), idx);
  return matches.map(p => folderRow(p, 0, idx, new Set(), favs, { expandible: false, label: lastSegment(p), detalle: shortPath(dirname(p)) }));
}

// Qué hay que desplegar y qué fila seleccionar para enseñar una carpeta en el árbol
export function revealFolder(path: string, idx: FolderIndex, raices: string[]): { expand: string[]; key: string } {
  if (normalizePath(path) === normalizePath(HOME)) return { expand: [], key: folderKey(HOME, 'h') };
  const { tops } = topLevelFolders(idx, raices);
  const top = tops.filter(t => isInside(path, t)).sort((a, b) => b.length - a.length)[0];
  if (!top) return { expand: [], key: TODAS };
  const expand: string[] = [];
  let p = dirname(path);
  while (isInside(p, top)) {
    expand.push(normalizePath(p));
    const up = dirname(p);
    if (up === p) break;
    p = up;
  }
  return { expand, key: folderKey(path) };
}

export function isSelectable(row: TreeRow): boolean {
  return row.kind !== 'grupo';
}

// Rama de git leyendo .git/HEAD, sin lanzar git
export function gitBranch(path: string): string | null {
  let dir = path;
  for (let i = 0; i < 20; i++) {
    const head = join(dir, '.git', 'HEAD');
    if (existsSync(head)) {
      try {
        const ref = readFileSync(head, 'utf-8').trim();
        return ref.startsWith('ref: refs/heads/') ? ref.slice('ref: refs/heads/'.length) : ref.slice(0, 8);
      } catch {
        return null;
      }
    }
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return null;
}
