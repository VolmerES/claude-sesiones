import { copyFileSync, existsSync, mkdirSync, symlinkSync } from 'fs';
import { join } from 'path';
import { HOME } from './paths.js';
import { t } from '../i18n.js';

// Lo que se comparte con la cuenta principal. Lo demás (credenciales, .claude.json,
// sesiones abiertas) es de cada cuenta
const SHARED_DIRS = ['projects', 'plugins', 'skills', 'plans', 'agents', 'commands', 'output-styles'];
const SHARED_FILES = ['settings.json', 'CLAUDE.md', 'keybindings.json', 'statusline.js'];

export function createAccount(nombre: string): string[] {
  if (!/^[a-z0-9_-]+$/i.test(nombre)) throw new Error(t('adminBadName'));
  const dir = join(HOME, `.claude-${nombre}`);
  if (existsSync(dir)) throw new Error(t('adminExists', { dir }));
  const base = join(HOME, '.claude');
  mkdirSync(dir, { recursive: true });
  const log = [t('adminCreated', { dir })];
  for (const d of SHARED_DIRS) {
    if (!existsSync(join(base, d))) continue;
    // En Windows una «junction» no necesita permisos de administrador
    symlinkSync(join(base, d), join(dir, d), 'junction');
    log.push(t('adminSharedDir', { name: d }));
  }
  for (const f of SHARED_FILES) {
    if (!existsSync(join(base, f))) continue;
    try {
      symlinkSync(join(base, f), join(dir, f), 'file');
      log.push(t('adminSharedFile', { name: f }));
    } catch {
      // Los enlaces a ficheros en Windows piden el modo de desarrollador
      copyFileSync(join(base, f), join(dir, f));
      log.push(t('adminCopied', { name: f }));
    }
  }
  return log;
}
