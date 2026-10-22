import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { CcsConfig } from '../core/config.js';
import { reloadConfig, saveConfig } from '../core/config.js';
import { HOME } from '../core/paths.js';
import { setLang } from '../i18n.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cses-config-'));
  process.env.CSES_DIR = dir;
});

afterEach(() => {
  delete process.env.CSES_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const config: CcsConfig = {
  configurado: true,
  cuentaPorDefecto: 'trabajo',
  raices: [join(HOME, 'proyectos')],
  reglas: [{ carpeta: join(HOME, 'clientes'), cuenta: 'trabajo' }],
  terminal: 'ventana',
  raton: false,
};

describe('guardar la configuración', () => {
  it('en castellano, con las rutas con «~»', () => {
    setLang('es');
    saveConfig(config);
    const raw = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf-8'));
    expect(raw).toEqual({
      configurado: true,
      cuentaPorDefecto: 'trabajo',
      raices: ['~/proyectos'],
      reglas: [{ carpeta: '~/clientes', cuenta: 'trabajo' }],
      terminal: 'ventana',
      raton: false,
    });
  });

  it('en inglés, con las claves en inglés', () => {
    setLang('en');
    saveConfig(config);
    const raw = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf-8'));
    expect(raw).toMatchObject({ configured: true, defaultAccount: 'trabajo', roots: ['~/proyectos'], terminal: 'window', mouse: false });
    expect(raw.rules).toEqual([{ folder: '~/clientes', account: 'trabajo' }]);
  });

  it('se lee igual que se guardó', () => {
    setLang('es');
    saveConfig(config);
    expect(reloadConfig()).toEqual(config);
  });
});
