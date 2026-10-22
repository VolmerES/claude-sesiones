import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { csesDir } from './paths.js';

// El supervisor (que tiene a claude en su panel) y el panel de cuentas se hablan con
// ficheros en ~/.cses/paneles/: el supervisor dice qué está abierto y el panel le deja
// la orden de cambiar de cuenta

export interface PanelState {
  supervisor: number;
  claudePid: number | null;
  cuenta: string;
  cwd: string;
  sessionId: string | null;
  titulo: string;
  // Qué cuenta había desde cuándo: para saber de quién es cada aviso de límite
  historial: Array<{ cuenta: string; desde: number }>;
}

export interface PanelOrder {
  cuenta: string;
}

const panelsDir = () => join(csesDir(), 'paneles');
const stateFile = (id: string) => join(panelsDir(), `${id}.estado.json`);
const orderFile = (id: string) => join(panelsDir(), `${id}.orden.json`);

export const newPanelId = () => randomBytes(6).toString('hex');

// Escribir aparte y renombrar: quien lee nunca ve un fichero a medias
function writeAtomic(file: string, data: unknown) {
  mkdirSync(panelsDir(), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, file);
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export const writeState = (id: string, state: PanelState) => writeAtomic(stateFile(id), state);
export const readState = (id: string) => readJson<PanelState>(stateFile(id));
export const writeOrder = (id: string, order: PanelOrder) => writeAtomic(orderFile(id), order);

// Lee la orden y la borra, para no cumplirla dos veces
export function takeOrder(id: string): PanelOrder | null {
  const order = readJson<PanelOrder>(orderFile(id));
  if (order) {
    try {
      unlinkSync(orderFile(id));
    } catch {
      // Ya la ha borrado otro
    }
  }
  return order;
}

// Lo que dejaron supervisores que no terminaron bien (pestaña cerrada a la fuerza)
export function prunePanels(isAlive: (pid: number) => boolean) {
  let files: string[];
  try {
    files = readdirSync(panelsDir());
  } catch {
    return;
  }
  for (const f of files) {
    const m = /^(\w+)\.estado\.json$/.exec(f);
    if (!m) continue;
    const state = readState(m[1]);
    if (!state || !isAlive(state.supervisor)) removePanel(m[1]);
  }
}

export function removePanel(id: string) {
  for (const f of [stateFile(id), orderFile(id)]) {
    try {
      unlinkSync(f);
    } catch {
      // No estaba
    }
  }
}

// ── Límites de uso ───────────────────────────────────────────────────────

export interface LimitHit {
  // El aviso tal cual: «You've hit your session limit · resets 1:30pm (Europe/Madrid)»
  texto: string;
  // Cuándo lo escribió Claude
  ts: number;
  // Cuándo se renueva, si se ha podido leer del aviso
  hasta: number | null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const RESETS = /resets\s+(?:([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;

// Hora de renovación de un aviso, en la hora local, a partir de cuándo se escribió
export function parseReset(texto: string, ts: number): number | null {
  const m = RESETS.exec(texto);
  if (!m) return null;
  let hour = Number(m[3]) % 12;
  if (m[5].toLowerCase() === 'pm') hour += 12;
  const minute = Number(m[4] ?? 0);
  const base = new Date(ts);
  if (m[1]) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    if (month === -1) return null;
    const d = new Date(base.getFullYear(), month, Number(m[2]), hour, minute);
    if (d.getTime() < ts) d.setFullYear(d.getFullYear() + 1);
    return d.getTime();
  }
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute);
  if (d.getTime() <= ts) d.setDate(d.getDate() + 1);
  return d.getTime();
}

interface TranscriptLine {
  type?: string;
  isMeta?: boolean;
  timestamp?: string;
  message?: { model?: string; content?: unknown };
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b): b is { type: string; text: string } => typeof b === 'object' && b !== null && (b as { type?: string }).type === 'text')
    .map(b => b.text)
    .join(' ');
}

const isPrompt = (l: TranscriptLine) =>
  l.type === 'user' && !l.isMeta && textOf(l.message?.content).trim() !== '';

/**
 * Si lo último que pasó en la conversación es un aviso de límite, lo devuelve. Recibe el
 * final del fichero .jsonl; la primera línea puede venir cortada.
 */
export function limitFromTail(tail: string): LimitHit | null {
  const lines = tail.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    let l: TranscriptLine;
    try {
      l = JSON.parse(lines[i]) as TranscriptLine;
    } catch {
      continue;
    }
    if (isPrompt(l)) return null;
    if (l.type !== 'assistant') continue;
    const text = textOf(l.message?.content);
    if (l.message?.model === '<synthetic>' && /limit/i.test(text)) {
      const ts = l.timestamp ? Date.parse(l.timestamp) : Date.now();
      return { texto: text.trim(), ts, hasta: parseReset(text, ts) };
    }
    if (l.message?.model !== '<synthetic>') return null;
  }
  return null;
}

// La cuenta que estaba en uso en un momento dado
export function accountAt(historial: PanelState['historial'], ts: number): string | null {
  let found: string | null = null;
  for (const h of historial) if (h.desde <= ts) found = h.cuenta;
  return found;
}

// ── Avisos guardados por cuenta ──────────────────────────────────────────

const limitsFile = () => join(csesDir(), 'limites.json');
// Si el aviso no dice cuándo se renueva, se da por pasado al cabo de 5 horas
const DEFAULT_LIMIT_MS = 5 * 60 * 60 * 1000;

export function loadLimits(now = Date.now()): Record<string, LimitHit> {
  const all = readJson<Record<string, LimitHit>>(limitsFile()) ?? {};
  const active: Record<string, LimitHit> = {};
  for (const [cuenta, hit] of Object.entries(all)) {
    if (now < (hit.hasta ?? hit.ts + DEFAULT_LIMIT_MS)) active[cuenta] = hit;
  }
  return active;
}

export function saveLimit(cuenta: string, hit: LimitHit) {
  const all = loadLimits();
  if (all[cuenta]?.ts === hit.ts) return;
  all[cuenta] = hit;
  writeAtomic(limitsFile(), all);
}

// ── Leer el final de la conversación ─────────────────────────────────────

const transcriptCache = new Map<string, string>();

// El .jsonl de una conversación dentro de un projects/
export function findTranscript(projectsDir: string, sessionId: string): string | null {
  const key = `${projectsDir}|${sessionId}`;
  const cached = transcriptCache.get(key);
  if (cached && existsSync(cached)) return cached;
  let dirs: string[];
  try {
    dirs = readdirSync(projectsDir);
  } catch {
    return null;
  }
  for (const d of dirs) {
    const file = join(projectsDir, d, `${sessionId}.jsonl`);
    if (existsSync(file)) {
      transcriptCache.set(key, file);
      return file;
    }
  }
  return null;
}

export function readTail(file: string, bytes = 64 * 1024): string {
  let fd: number | null = null;
  try {
    const size = statSync(file).size;
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    fd = openSync(file, 'r');
    readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf-8');
  } catch {
    return '';
  } finally {
    if (fd !== null) closeSync(fd);
  }
}
