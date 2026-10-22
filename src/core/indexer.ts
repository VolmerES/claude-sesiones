import { open, readdir, stat, readFile, writeFile, rename, mkdir } from 'fs/promises';
import { realpathSync } from 'fs';
import { join, dirname } from 'path';
import type { Account } from './accounts.js';
import { indexFile, normalizePath } from './paths.js';
import { t } from '../i18n.js';

// Subir este número obliga a reindexar todo (cambia lo que se guarda por sesión)
const INDEX_VERSION = 1;
const MAX_TURNS = 24;
const MAX_TURN_CHARS = 1500;
const HEAD_BYTES = 400;
const CHUNK = 1 << 20;
const SESSION_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

export interface Turn {
  rol: 'tu' | 'claude';
  texto: string;
  ts: string | null;
  // «/comando» o «! orden de shell»: no cuentan como mensaje
  comando?: boolean;
}

export interface SessionRecord {
  v: number;
  id: string;
  file: string;
  projectsReal: string;
  mtime: number;
  size: number;
  offset: number;
  cwd: string | null;
  branch: string | null;
  aiTitle: string | null;
  customTitle: string | null;
  agentName: string | null;
  primero: string | null;
  prompts: number;
  respuestas: number;
  inicio: string | null;
  fin: string | null;
  ultimos: Turn[];
  ultimoMsgId: string | null;
}

interface IndexFile {
  v: number;
  sesiones: Record<string, SessionRecord>;
}

export interface IndexProgress {
  hechos: number;
  total: number;
  bytes: number;
}

function emptyRecord(id: string, file: string, projectsReal: string): SessionRecord {
  return {
    v: INDEX_VERSION, id, file, projectsReal, mtime: 0, size: 0, offset: 0,
    cwd: null, branch: null, aiTitle: null, customTitle: null, agentName: null,
    primero: null, prompts: 0, respuestas: 0, inicio: null, fin: null, ultimos: [], ultimoMsgId: null,
  };
}

const SKIP_PREFIXES = [
  '<local-command-', '<system-reminder', '<bash-stdout', '<bash-stderr', '<task-notification',
  '<user-prompt-submit-hook', 'Caveat: The messages below', '[Request interrupted',
];

// Convierte un mensaje del usuario en lo que se enseña, o null si no es algo que haya escrito él
export function cleanUserText(text: string): { texto: string; comando: boolean } | null {
  const t = text.trim();
  if (!t) return null;
  const cmd = /<command-name>([\s\S]*?)<\/command-name>/.exec(t);
  if (cmd) {
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(t);
    return { texto: `${cmd[1].trim()} ${args ? args[1].trim() : ''}`.trim(), comando: true };
  }
  const bash = /<bash-input>([\s\S]*?)<\/bash-input>/.exec(t);
  if (bash) return { texto: `! ${bash[1].trim()}`, comando: true };
  if (SKIP_PREFIXES.some(p => t.startsWith(p))) return null;
  return { texto: t, comando: false };
}

type Block = { type?: string; text?: string };

function userText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content as Block[]) {
    if (block?.type === 'tool_result') return null;
    if (block?.type === 'text' && block.text) parts.push(block.text);
    else if (block?.type === 'image') parts.push('[imagen]');
  }
  return parts.length ? parts.join('\n') : null;
}

function assistantText(content: unknown): string | null {
  if (!Array.isArray(content)) return typeof content === 'string' ? content : null;
  const parts = (content as Block[]).filter(b => b?.type === 'text' && b.text).map(b => b.text as string);
  return parts.length ? parts.join('\n') : null;
}

function pushTurn(rec: SessionRecord, turn: Turn) {
  turn.texto = turn.texto.length > MAX_TURN_CHARS ? turn.texto.slice(0, MAX_TURN_CHARS) + '…' : turn.texto;
  rec.ultimos.push(turn);
  if (rec.ultimos.length > MAX_TURNS) rec.ultimos.splice(0, rec.ultimos.length - MAX_TURNS);
}

interface RawLine {
  type?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  isCompactSummary?: boolean;
  cwd?: string;
  gitBranch?: string;
  timestamp?: string;
  aiTitle?: string;
  customTitle?: string;
  agentName?: string;
  summary?: string;
  message?: { id?: string; model?: string; content?: unknown };
}

function common(rec: SessionRecord, d: RawLine) {
  if (!rec.cwd && d.cwd) rec.cwd = d.cwd;
  if (d.gitBranch) rec.branch = d.gitBranch;
  if (d.timestamp) {
    if (!rec.inicio) rec.inicio = d.timestamp;
    rec.fin = d.timestamp;
  }
}

// Las líneas pesadas (resultados de herramientas, peticiones a la API) se descartan
// mirando solo la cabecera, sin parsear el JSON
export function processLine(rec: SessionRecord, line: Buffer) {
  const head = line.toString('latin1', 0, Math.min(line.length, HEAD_BYTES));
  if (head.startsWith('{"type":"')) {
    if (!/^\{"type":"(ai-title|custom-title|agent-name|summary)"/.test(head)) return;
    const d = JSON.parse(line.toString('utf8')) as RawLine;
    if (d.type === 'ai-title' && d.aiTitle) rec.aiTitle = d.aiTitle;
    else if (d.type === 'custom-title' && d.customTitle) rec.customTitle = d.customTitle;
    else if (d.type === 'agent-name' && d.agentName) rec.agentName = d.agentName;
    else if (d.type === 'summary' && d.summary && !rec.aiTitle) rec.aiTitle = d.summary;
    return;
  }
  if (head.includes('"type":"user"')) {
    if (head.includes('"tool_use_id"')) return;
    const d = JSON.parse(line.toString('utf8')) as RawLine;
    if (d.isSidechain || d.isMeta || d.isCompactSummary) return;
    common(rec, d);
    const raw = userText(d.message?.content);
    if (raw === null) return;
    const clean = cleanUserText(raw);
    if (!clean) return;
    if (!clean.comando) {
      rec.prompts++;
      if (!rec.primero) rec.primero = clean.texto.slice(0, 500);
    }
    pushTurn(rec, { rol: 'tu', texto: clean.texto, ts: d.timestamp ?? null, comando: clean.comando || undefined });
    rec.ultimoMsgId = null;
    return;
  }
  if (head.includes('"role":"assistant"')) {
    if (!head.includes('"content":[{"type":"text"')) return;
    const d = JSON.parse(line.toString('utf8')) as RawLine;
    if (d.isSidechain || d.message?.model === '<synthetic>') return;
    common(rec, d);
    const text = assistantText(d.message?.content);
    if (!text) return;
    const msgId = d.message?.id ?? null;
    const last = rec.ultimos[rec.ultimos.length - 1];
    // Una misma respuesta puede venir partida en varias líneas
    if (last && last.rol === 'claude' && msgId && rec.ultimoMsgId === msgId) {
      last.texto = (last.texto + '\n' + text).slice(0, MAX_TURN_CHARS);
      return;
    }
    rec.respuestas++;
    rec.ultimoMsgId = msgId;
    pushTurn(rec, { rol: 'claude', texto: text, ts: d.timestamp ?? null });
  }
}

async function readFrom(rec: SessionRecord, start: number): Promise<number> {
  const fh = await open(rec.file, 'r');
  try {
    let pos = start;
    let carry: Buffer = Buffer.alloc(0);
    const buf = Buffer.allocUnsafe(CHUNK);
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, CHUNK, pos + carry.length);
      if (bytesRead === 0) break;
      const data = carry.length ? Buffer.concat([carry, buf.subarray(0, bytesRead)]) : Buffer.from(buf.subarray(0, bytesRead));
      let lineStart = 0;
      let nl = data.indexOf(0x0a, lineStart);
      while (nl !== -1) {
        if (nl > lineStart) {
          try {
            processLine(rec, data.subarray(lineStart, nl));
          } catch {
            // Línea corrupta o a medio escribir: se ignora
          }
        }
        lineStart = nl + 1;
        nl = data.indexOf(0x0a, lineStart);
      }
      pos += lineStart;
      carry = data.subarray(lineStart);
    }
    // Lo que queda sin salto de línea se vuelve a leer la próxima vez
    return pos;
  } finally {
    await fh.close();
  }
}

async function loadIndexFile(): Promise<Record<string, SessionRecord>> {
  try {
    const data = JSON.parse(await readFile(indexFile(), 'utf-8')) as IndexFile;
    return data.v === INDEX_VERSION ? data.sesiones : {};
  } catch {
    return {};
  }
}

async function saveIndexFile(sesiones: Record<string, SessionRecord>) {
  const target = indexFile();
  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ v: INDEX_VERSION, sesiones } satisfies IndexFile));
  await rename(tmp, target);
}

interface FoundFile {
  id: string;
  file: string;
  projectsReal: string;
  mtime: number;
  size: number;
}

// Cada projects/ distinto, una sola vez aunque varias cuentas lo compartan por enlace
export function projectRoots(accounts: Account[]): Array<{ real: string; path: string }> {
  const seen = new Map<string, string>();
  for (const a of accounts) {
    if (!a.projectsReal || seen.has(a.projectsReal)) continue;
    try {
      seen.set(a.projectsReal, realpathSync(join(a.dir, 'projects')));
    } catch {
      // projects/ desaparecido desde que se leyó la cuenta
    }
  }
  return [...seen].map(([real, path]) => ({ real, path }));
}

async function findFiles(accounts: Account[]): Promise<FoundFile[]> {
  const found: FoundFile[] = [];
  for (const root of projectRoots(accounts)) {
    let dirs: string[];
    try {
      dirs = await readdir(root.path);
    } catch {
      continue;
    }
    for (const dir of dirs) {
      let files: string[];
      try {
        files = await readdir(join(root.path, dir));
      } catch {
        continue;
      }
      for (const f of files) {
        if (!SESSION_FILE.test(f)) continue;
        const file = join(root.path, dir, f);
        try {
          const st = await stat(file);
          found.push({ id: f.slice(0, -'.jsonl'.length), file, projectsReal: root.real, mtime: st.mtimeMs, size: st.size });
        } catch {
          // Borrado mientras se listaba
        }
      }
    }
  }
  return found;
}

export async function updateIndex(
  accounts: Account[],
  onProgress?: (p: IndexProgress) => void,
): Promise<SessionRecord[]> {
  const previous = await loadIndexFile();
  const files = await findFiles(accounts);
  const next: Record<string, SessionRecord> = {};
  const pending = files.filter(f => {
    const prev = previous[normalizePath(f.file)];
    return !prev || prev.mtime !== f.mtime || prev.size !== f.size;
  });
  let done = 0;
  let bytes = 0;
  const pendingKeys = new Set(pending.map(f => normalizePath(f.file)));
  for (const f of files) {
    const key = normalizePath(f.file);
    const prev = previous[key];
    if (!pendingKeys.has(key) && prev) {
      next[key] = prev;
      continue;
    }
    // Si el fichero solo ha crecido se sigue desde donde se dejó
    const grown = prev && f.size >= prev.offset;
    const rec = grown ? prev : emptyRecord(f.id, f.file, f.projectsReal);
    try {
      bytes += f.size - (grown ? prev.offset : 0);
      rec.offset = await readFrom(rec, grown ? prev.offset : 0);
      rec.mtime = f.mtime;
      rec.size = f.size;
      next[key] = rec;
    } catch {
      if (prev) next[key] = prev;
    }
    done++;
    onProgress?.({ hechos: done, total: pending.length, bytes });
    // Deja respirar al bucle de eventos para que la interfaz pinte el progreso
    if (done % 4 === 0) await new Promise(r => setImmediate(r));
  }
  if (pending.length > 0 || Object.keys(previous).length !== files.length) {
    await saveIndexFile(next);
  }
  return Object.values(next);
}

export function titleOf(rec: SessionRecord): string {
  const title = rec.customTitle ?? rec.aiTitle ?? rec.primero ?? rec.agentName ?? t('untitled');
  return title.replace(/\s+/g, ' ').trim();
}

// Las sesiones que se abrieron y se cerraron sin escribir nada no se listan
export function visibleSessions(records: SessionRecord[]): SessionRecord[] {
  return records.filter(r => r.prompts > 0 && r.cwd).sort((a, b) => b.mtime - a.mtime);
}
