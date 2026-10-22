import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Account } from '../core/accounts.js';
import { cleanUserText, processLine, titleOf, updateIndex, visibleSessions } from '../core/indexer.js';
import type { SessionRecord } from '../core/indexer.js';

const ID = '11111111-2222-3333-4444-555555555555';

function emptyRec(): SessionRecord {
  return {
    v: 1, id: ID, file: '', projectsReal: '', mtime: 0, size: 0, offset: 0, cwd: null, branch: null,
    aiTitle: null, customTitle: null, agentName: null, primero: null, prompts: 0, respuestas: 0,
    inicio: null, fin: null, ultimos: [], ultimoMsgId: null,
  };
}

// Las líneas reales llevan los campos en este orden: el indexador se fía de ello
const user = (content: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({
  parentUuid: null, isSidechain: false, promptId: 'p', type: 'user', message: { role: 'user', content },
  uuid: 'u', timestamp: '2026-10-20T10:00:00.000Z', cwd: 'C:\\proyectos\\demo', gitBranch: 'main', ...extra,
});
const assistant = (id: string, blocks: unknown[], model = 'claude-opus-5-5') => JSON.stringify({
  parentUuid: 'u', isSidechain: false, message: { model, id, type: 'message', role: 'assistant', content: blocks },
  type: 'assistant', timestamp: '2026-10-20T10:00:05.000Z', cwd: 'C:\\proyectos\\demo',
});

const feed = (rec: SessionRecord, ...lines: string[]) => lines.forEach(l => processLine(rec, Buffer.from(l)));

describe('cleanUserText', () => {
  it('convierte los comandos en «/comando args»', () => {
    expect(cleanUserText('<command-name>/model</command-name>\n<command-args>opus</command-args>'))
      .toEqual({ texto: '/model opus', comando: true });
  });

  it('marca las órdenes de shell con «!»', () => {
    expect(cleanUserText('<bash-input>git status</bash-input>')).toEqual({ texto: '! git status', comando: true });
  });

  it('descarta lo que no escribió el usuario', () => {
    expect(cleanUserText('<local-command-stdout>hola</local-command-stdout>')).toBeNull();
    expect(cleanUserText('[Request interrupted by user]')).toBeNull();
    expect(cleanUserText('   ')).toBeNull();
  });
});

describe('processLine', () => {
  it('recoge el primer mensaje, la carpeta, la rama y el título', () => {
    const rec = emptyRec();
    feed(rec,
      user('arregla el login'),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Arreglo del login', sessionId: ID }),
      user('y ahora los tests'),
    );
    expect(rec.cwd).toBe('C:\\proyectos\\demo');
    expect(rec.branch).toBe('main');
    expect(rec.primero).toBe('arregla el login');
    expect(rec.prompts).toBe(2);
    expect(titleOf(rec)).toBe('Arreglo del login');
  });

  it('el título puesto a mano gana al generado', () => {
    const rec = emptyRec();
    feed(rec,
      JSON.stringify({ type: 'custom-title', customTitle: 'Mi nombre', sessionId: ID }),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Generado', sessionId: ID }),
    );
    expect(titleOf(rec)).toBe('Mi nombre');
  });

  it('ignora resultados de herramientas, mensajes meta y respuestas sintéticas', () => {
    const rec = emptyRec();
    feed(rec,
      user([{ tool_use_id: 'x', type: 'tool_result', content: 'salida' }]),
      user('aviso interno', { isMeta: true }),
      assistant('m0', [{ type: 'text', text: 'No response requested.' }], '<synthetic>'),
      assistant('m1', [{ type: 'thinking', thinking: '…' }]),
    );
    expect(rec.prompts).toBe(0);
    expect(rec.ultimos).toEqual([]);
  });

  it('junta una respuesta partida en varias líneas', () => {
    const rec = emptyRec();
    feed(rec,
      user('hola'),
      assistant('m1', [{ type: 'text', text: 'primera parte' }]),
      assistant('m1', [{ type: 'text', text: 'segunda parte' }]),
      assistant('m2', [{ type: 'text', text: 'otra respuesta' }]),
    );
    expect(rec.ultimos.map(t => [t.rol, t.texto])).toEqual([
      ['tu', 'hola'],
      ['claude', 'primera parte\nsegunda parte'],
      ['claude', 'otra respuesta'],
    ]);
  });

  it('los comandos salen en la conversación pero no cuentan como mensaje', () => {
    const rec = emptyRec();
    feed(rec, user('<command-name>/clear</command-name>'));
    expect(rec.prompts).toBe(0);
    expect(rec.primero).toBeNull();
    expect(rec.ultimos[0]).toMatchObject({ texto: '/clear', comando: true });
  });
});

describe('updateIndex', () => {
  let home: string;
  let account: Account;
  let file: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'cses-'));
    process.env.CSES_DIR = join(home, '.cses');
    const projects = join(home, '.claude', 'projects');
    mkdirSync(join(projects, 'C--proyectos-demo'), { recursive: true });
    file = join(projects, 'C--proyectos-demo', `${ID}.jsonl`);
    account = {
      nombre: 'prueba', dir: join(home, '.claude'), principal: true, email: null, conSesion: true,
      projectsReal: projects.toLowerCase(),
    };
  });

  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('lee solo lo nuevo cuando el fichero crece y no lista sesiones vacías', async () => {
    writeFileSync(file, user('uno') + '\n');
    // Sesión abierta y cerrada sin escribir nada
    writeFileSync(join(home, '.claude', 'projects', 'C--proyectos-demo', '99999999-2222-3333-4444-555555555555.jsonl'),
      JSON.stringify({ type: 'mode', mode: 'normal' }) + '\n');

    let all = await updateIndex([account]);
    expect(all).toHaveLength(2);
    expect(visibleSessions(all).map(s => s.id)).toEqual([ID]);

    // Una línea a medio escribir no se cuenta hasta que se completa
    appendFileSync(file, user('dos') + '\n' + user('tres').slice(0, 30));
    all = await updateIndex([account]);
    let rec = all.find(s => s.id === ID) as SessionRecord;
    expect(rec.prompts).toBe(2);

    appendFileSync(file, user('tres').slice(30) + '\n');
    all = await updateIndex([account]);
    rec = all.find(s => s.id === ID) as SessionRecord;
    expect(rec.prompts).toBe(3);
    expect(rec.ultimos.map(t => t.texto)).toEqual(['uno', 'dos', 'tres']);
  });
});
