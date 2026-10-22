import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  accountAt, limitFromTail, loadLimits, parseReset, prunePanels, readState, saveLimit, takeOrder, writeOrder, writeState,
} from '../core/panelLink.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cses-panel-'));
  process.env.CSES_DIR = dir;
});

afterEach(() => {
  delete process.env.CSES_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo, d, h, mi).getTime();

const prompt = (text: string, ts = '2026-10-22T10:00:00.000Z') =>
  JSON.stringify({ type: 'user', timestamp: ts, message: { role: 'user', content: text } });
const answer = (text: string, ts = '2026-10-22T10:00:05.000Z') =>
  JSON.stringify({ type: 'assistant', timestamp: ts, message: { model: 'claude-opus-5-5', content: [{ type: 'text', text }] } });
const limit = (text: string, ts = '2026-10-22T10:01:00.000Z') =>
  JSON.stringify({ type: 'assistant', timestamp: ts, message: { model: '<synthetic>', content: [{ type: 'text', text }] } });
const toolResult = () =>
  JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } });

describe('hora de renovación del límite', () => {
  it('lee la hora del aviso y la pone después de cuándo se escribió', () => {
    const ts = at(2026, 9, 22, 11, 5);
    expect(parseReset("You've hit your session limit · resets 1:30pm (Europe/Madrid)", ts)).toBe(at(2026, 9, 22, 13, 30));
    expect(parseReset('resets 6pm', ts)).toBe(at(2026, 9, 22, 18));
  });

  it('si la hora ya ha pasado hoy, es mañana', () => {
    expect(parseReset('resets 9am', at(2026, 9, 22, 23))).toBe(at(2026, 9, 23, 9));
    expect(parseReset('resets 12am', at(2026, 9, 22, 23))).toBe(at(2026, 9, 23, 0));
  });

  it('entiende el límite semanal con fecha', () => {
    expect(parseReset("You've hit your weekly limit · resets Oct 27, 9am", at(2026, 9, 22, 11))).toBe(at(2026, 9, 27, 9));
  });

  it('sin hora, null', () => {
    expect(parseReset('Claude AI usage limit reached', Date.now())).toBeNull();
  });
});

describe('aviso de límite al final de la conversación', () => {
  it('lo encuentra si es lo último que ha pasado', () => {
    const tail = [prompt('hola'), answer('qué tal'), prompt('sigue'), limit("You've hit your session limit · resets 1:30pm")].join('\n');
    const hit = limitFromTail(tail);
    expect(hit?.texto).toContain('session limit');
    expect(hit?.hasta).not.toBeNull();
  });

  it('no lo da por bueno si después se escribió otra cosa', () => {
    expect(limitFromTail([limit("You've hit your session limit"), prompt('¿sigues?')].join('\n'))).toBeNull();
    expect(limitFromTail([limit("You've hit your session limit"), answer('sí, sigo')].join('\n'))).toBeNull();
  });

  it('se salta líneas cortadas y resultados de herramientas', () => {
    const tail = ['{"type":"assistant","mess', limit("You've hit your session limit"), toolResult()].join('\n');
    expect(limitFromTail(tail)).not.toBeNull();
  });

  it('una respuesta normal no es un límite', () => {
    expect(limitFromTail([prompt('hola'), answer('el limit de la API es 10')].join('\n'))).toBeNull();
  });
});

describe('canal entre el supervisor y el panel', () => {
  const state = {
    supervisor: process.pid, claudePid: 1, cuenta: 'principal', cwd: dir, sessionId: 'abc', titulo: 'x',
    historial: [{ cuenta: 'principal', desde: 0 }],
  };

  it('el estado se lee como se escribió', () => {
    writeState('p1', state);
    expect(readState('p1')).toEqual(state);
  });

  it('una orden se cumple una sola vez', () => {
    writeOrder('p1', { cuenta: 'fija' });
    expect(takeOrder('p1')).toEqual({ cuenta: 'fija' });
    expect(takeOrder('p1')).toBeNull();
  });

  it('limpia lo de los supervisores que ya no están', () => {
    writeState('vivo', state);
    writeState('muerto', { ...state, supervisor: 999999 });
    prunePanels(pid => pid === process.pid);
    expect(readState('vivo')).not.toBeNull();
    expect(readState('muerto')).toBeNull();
  });

  it('cada aviso es de la cuenta que había cuando se escribió', () => {
    const historial = [{ cuenta: 'principal', desde: 100 }, { cuenta: 'fija', desde: 200 }];
    expect(accountAt(historial, 150)).toBe('principal');
    expect(accountAt(historial, 250)).toBe('fija');
    expect(accountAt(historial, 50)).toBeNull();
  });
});

describe('avisos guardados', () => {
  it('caducan cuando se renueva el límite', () => {
    const now = Date.now();
    saveLimit('principal', { texto: 'a', ts: now - 1000, hasta: now + 60_000 });
    saveLimit('fija', { texto: 'b', ts: now - 1000, hasta: now - 1 });
    expect(Object.keys(loadLimits(now))).toEqual(['principal']);
  });

  it('sin hora de renovación, duran 5 horas', () => {
    const now = Date.now();
    saveLimit('principal', { texto: 'a', ts: now - 6 * 3600_000, hasta: null });
    saveLimit('fija', { texto: 'b', ts: now - 3600_000, hasta: null });
    expect(Object.keys(loadLimits(now))).toEqual(['fija']);
  });
});
