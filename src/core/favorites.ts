import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { csesDir, normalizePath } from './paths.js';

export interface Favorites {
  conversaciones: string[];
  carpetas: string[];
}

const favoritesFile = () => join(csesDir(), 'favoritos.json');

export function loadFavorites(): Favorites {
  try {
    const data = JSON.parse(readFileSync(favoritesFile(), 'utf-8')) as Partial<Favorites>;
    return { conversaciones: data.conversaciones ?? [], carpetas: data.carpetas ?? [] };
  } catch {
    return { conversaciones: [], carpetas: [] };
  }
}

export function saveFavorites(favs: Favorites) {
  mkdirSync(csesDir(), { recursive: true });
  const tmp = `${favoritesFile()}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(favs, null, 2));
  renameSync(tmp, favoritesFile());
}

export function toggleConversation(favs: Favorites, id: string): Favorites {
  const has = favs.conversaciones.includes(id);
  return { ...favs, conversaciones: has ? favs.conversaciones.filter(x => x !== id) : [...favs.conversaciones, id] };
}

export function toggleFolder(favs: Favorites, path: string): Favorites {
  const key = normalizePath(path);
  const has = favs.carpetas.some(p => normalizePath(p) === key);
  return { ...favs, carpetas: has ? favs.carpetas.filter(p => normalizePath(p) !== key) : [...favs.carpetas, path] };
}
