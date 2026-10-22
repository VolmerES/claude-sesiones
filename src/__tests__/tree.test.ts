import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { SessionRecord } from '../core/indexer.js';
import type { FolderRow, TreeRow } from '../core/tree.js';
import { TODAS, buildFolderIndex, buildTree, clearSubdirCache, folderKey, revealFolder, searchFolders } from '../core/tree.js';
import { normalizePath } from '../core/paths.js';
import { setLang } from '../i18n.js';

let root: string;

function session(id: string, cwd: string, mtime: number): SessionRecord {
  return {
    v: 1, id, file: '', projectsReal: '', mtime, size: 0, offset: 0, cwd, branch: null, aiTitle: id,
    customTitle: null, agentName: null, primero: id, prompts: 1, respuestas: 0, inicio: null, fin: null,
    ultimos: [], ultimoMsgId: null,
  };
}

const folders = (rows: TreeRow[]) => rows.filter((r): r is FolderRow => r.kind === 'carpeta');


beforeAll(() => setLang('es'));

beforeEach(() => {
  clearSubdirCache();
  root = mkdtempSync(join(tmpdir(), 'cses-arbol-'));
  // root/trabajo/{api,web/front}, root/personal/blog y una carpeta vacía
  for (const d of ['trabajo/api', 'trabajo/web/front', 'personal/blog', 'trabajo/vacia']) mkdirSync(join(root, d), { recursive: true });
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('árbol de carpetas', () => {
  it('cuenta las conversaciones de cada carpeta con sus subcarpetas', () => {
    const idx = buildFolderIndex([
      session('a', join(root, 'trabajo', 'api'), 3),
      session('b', join(root, 'trabajo', 'web', 'front'), 2),
      session('c', join(root, 'personal', 'blog'), 1),
    ]);
    expect(idx.stats.get(normalizePath(join(root, 'trabajo')))?.conversaciones).toBe(2);
    expect(idx.stats.get(normalizePath(join(root, 'trabajo', 'web')))?.conversaciones).toBe(1);
  });

  it('despliega solo lo pedido y pone primero lo más reciente', () => {
    const sessions = [
      session('a', join(root, 'trabajo', 'api'), 3),
      session('b', join(root, 'trabajo', 'web', 'front'), 5),
    ];
    const idx = buildFolderIndex(sessions);
    const raices = [join(root, 'trabajo'), join(root, 'personal')];

    // Plegado: «Todas» y las dos raíces, la que tiene conversaciones primero
    const collapsed = buildTree(idx, raices, new Set(), [], 2);
    expect(collapsed[0].kind).toBe('todas');
    expect(folders(collapsed).map(r => [r.path, r.conversaciones, r.expandible]))
      .toEqual([[join(root, 'trabajo'), 2, true], [join(root, 'personal'), 0, true]]);

    const expanded = new Set([normalizePath(join(root, 'trabajo'))]);
    const rows = folders(buildTree(idx, raices, expanded, [], 2));
    const trabajo = rows.find(r => r.path === join(root, 'trabajo')) as FolderRow;
    expect(trabajo.expandido).toBe(true);
    // web (más reciente) antes que api; la vacía al final
    const hijos = rows.filter(r => r.depth === 1).map(r => r.label);
    expect(hijos).toEqual(['web', 'api', 'vacia']);
    expect(rows.find(r => r.label === 'vacia')?.expandible).toBe(false);
  });

  it('las favoritas salen arriba, en su propio grupo', () => {
    const idx = buildFolderIndex([session('a', join(root, 'trabajo', 'api'), 3)]);
    const rows = buildTree(idx, [join(root, 'trabajo')], new Set(), [join(root, 'trabajo', 'api')], 1);
    expect(rows[0]).toMatchObject({ kind: 'todas', key: TODAS });
    expect(rows[1]).toEqual({ kind: 'grupo', label: '★ Favoritas' });
    expect(rows[2]).toMatchObject({ kind: 'carpeta', key: folderKey(join(root, 'trabajo', 'api'), 'f'), favorito: true });
  });

  it('al buscar, aplana el árbol y dice dónde está cada carpeta', () => {
    const idx = buildFolderIndex([session('a', join(root, 'trabajo', 'web', 'front'), 3)]);
    const rows = folders(searchFolders(idx, [join(root, 'trabajo')], 'front', []));
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('front');
    expect(rows[0].detalle).toContain('web');
  });

  it('revealFolder despliega los padres hasta la carpeta', () => {
    const target = join(root, 'trabajo', 'web', 'front');
    const idx = buildFolderIndex([session('a', target, 3)]);
    const r = revealFolder(target, idx, [join(root, 'trabajo')]);
    expect(r.key).toBe(folderKey(target));
    expect(new Set(r.expand)).toEqual(new Set([normalizePath(join(root, 'trabajo', 'web')), normalizePath(join(root, 'trabajo'))]));
  });
});
