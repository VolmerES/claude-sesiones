import type { SessionRecord, Turn } from '../core/indexer.js';
import { titleOf } from '../core/indexer.js';
import type { RunningSession } from '../core/running.js';
import type { FolderRow } from '../core/tree.js';
import { gitBranch, subdirs } from '../core/tree.js';
import { longDate, shortDate } from '../core/format.js';
import { isInside, lastSegment, normalizePath, shortPath } from '../core/paths.js';
import { plural, t } from '../i18n.js';
import { fit, wrap } from './text.js';
import { ACCENT, ERROR, FOLDER, MUTED, OK, WARN, line } from './theme.js';
import type { Line } from './theme.js';

export interface PreviewContent {
  // Fijo arriba
  header: Line[];
  // Se desplaza; por defecto se ve el final (lo último que se dijo)
  body: Line[];
}

export interface AccountHint {
  texto: string;
  aviso?: string;
}

const rule = (width: number): Line => [{ t: '─'.repeat(Math.max(0, width)), color: MUTED, dim: true }];

function when(ts: string | null): string {
  if (!ts) return '';
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? '' : `  ${longDate(ms)}`;
}

function turnLines(turn: Turn, width: number): Line[] {
  if (turn.rol === 'tu' && turn.comando) {
    return [line({ t: '❯ ', color: ACCENT }, { t: turn.texto.split('\n')[0], dim: true }, { t: when(turn.ts), dim: true })];
  }
  const out: Line[] = [turn.rol === 'tu'
    ? line({ t: `❯ ${t('you')}`, color: ACCENT, bold: true }, { t: when(turn.ts), dim: true })
    : line({ t: '✻ Claude', bold: true }, { t: when(turn.ts), dim: true })];
  for (const l of wrap(turn.texto, Math.max(10, width - 2))) out.push(line('  ' + l));
  return out;
}

function accountLines(account: AccountHint): Line[] {
  const out = [line({ t: t('account'), dim: true }, { t: account.texto })];
  if (account.aviso) out.push(line({ t: account.aviso, color: WARN }));
  return out;
}

function recentList(sessions: SessionRecord[], width: number, running: Map<string, RunningSession>, showFolder: boolean): Line[] {
  const dateW = 8;
  return sessions.slice(0, 15).map(s => line(
    { t: running.has(s.id) ? '● ' : '  ', color: OK },
    { t: fit((showFolder && s.cwd ? `${lastSegment(s.cwd)}: ` : '') + titleOf(s), Math.max(10, width - dateW - 3)) },
    { t: fit(shortDate(s.mtime), dateW, 'right'), dim: true },
  ));
}

export function sessionPreview(rec: SessionRecord, width: number, running: RunningSession | undefined, account: AccountHint): PreviewContent {
  const header: Line[] = [];
  for (const l of wrap(titleOf(rec), width).slice(0, 2)) header.push(line({ t: l, color: ACCENT, bold: true }));
  header.push(line(
    { t: shortPath(rec.cwd ?? '?'), color: FOLDER },
    { t: rec.branch && rec.branch !== 'HEAD' ? `  ⎇ ${rec.branch}` : '', dim: true },
  ));
  header.push(line({
    t: `${longDate(rec.inicio)} → ${longDate(rec.mtime)} · ${plural(rec.prompts, 'message', 'messages')} · ${rec.id.slice(0, 8)}`,
    dim: true,
  }));
  if (running) {
    const estado = running.estado === 'busy' ? t('busy') : running.estado === 'idle' ? t('idle') : running.estado;
    header.push(line({ t: t('openNow', { account: running.cuenta }) + (estado ? ` · ${estado}` : ''), color: OK }));
  }
  header.push(...accountLines(account), rule(width));

  const body: Line[] = [];
  const first = rec.ultimos.find(turn => turn.rol === 'tu' && !turn.comando);
  if (rec.primero && (!first || !rec.primero.startsWith(first.texto.slice(0, 200)))) {
    body.push(line({ t: t('startedWith'), dim: true, italic: true }));
    for (const l of wrap(rec.primero, Math.max(10, width - 2)).slice(0, 4)) body.push(line({ t: '  ' + l, dim: true, italic: true }));
    body.push(line({ t: '  ⋯', dim: true }), []);
  }
  rec.ultimos.forEach((turn, i) => {
    if (i > 0) body.push([]);
    body.push(...turnLines(turn, width));
  });
  return { header, body };
}

export function folderPreview(
  folder: FolderRow,
  width: number,
  sessions: SessionRecord[],
  running: Map<string, RunningSession>,
  account: AccountHint,
): PreviewContent {
  const header: Line[] = [line({ t: shortPath(folder.path), color: ACCENT, bold: true }), line({ t: folder.path, dim: true })];
  if (!folder.existe) header.push(line({ t: t('folderMissing'), color: ERROR }));
  const branch = folder.existe ? gitBranch(folder.path) : null;
  const resumen = folder.conversaciones
    ? `${plural(folder.conversaciones, 'conversation', 'conversations')} · ${t('lastActivity', { date: longDate(folder.ultima) })}`
    : t('noConvsYet');
  header.push(line({ t: resumen, dim: true }, { t: branch ? `  ⎇ ${branch}` : '', dim: true }));
  header.push(...accountLines(account), rule(width));

  const inside = sessions.filter(s => s.cwd && (folder.exact
    ? normalizePath(s.cwd) === normalizePath(folder.path)
    : isInside(s.cwd, folder.path)));
  const body: Line[] = [];
  if (inside.length) {
    const mixed = inside.some(s => normalizePath(s.cwd as string) !== normalizePath(folder.path));
    body.push(line({ t: t('colConvs'), bold: true }), ...recentList(inside, width, running, mixed), []);
  }
  const dirs = folder.existe && !folder.exact ? subdirs(folder.path) : [];
  if (dirs.length) {
    body.push(line({ t: t('subfolders'), bold: true }));
    for (const l of wrap(dirs.map(lastSegment).join('   '), width - 2)) body.push(line({ t: '  ' + l, color: FOLDER, dim: true }));
  }
  return { header, body };
}

export function allPreview(sessions: SessionRecord[], folders: number, width: number, running: Map<string, RunningSession>, account: AccountHint): PreviewContent {
  const header: Line[] = [
    line({ t: t('all'), color: ACCENT, bold: true }),
    line({ t: t('allSummary', { convs: plural(sessions.length, 'conversation', 'conversations'), folders }), dim: true }),
    ...accountLines(account),
    rule(width),
  ];
  return { header, body: recentList(sessions, width, running, true) };
}
