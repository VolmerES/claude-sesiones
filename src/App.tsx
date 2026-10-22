import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { dirname } from 'path';
import clipboardy from 'clipboardy';
import type { Account } from './core/accounts.js';
import { accountForFolder, defaultAccount, getAccounts } from './core/accounts.js';
import type { IndexProgress, SessionRecord } from './core/indexer.js';
import { titleOf, updateIndex, visibleSessions } from './core/indexer.js';
import type { RunningSession } from './core/running.js';
import { runningSessions } from './core/running.js';
import type { FolderRow, TreeRow } from './core/tree.js';
import {
  TODAS, buildFolderIndex, buildTree, clearSubdirCache, folderKey, isSelectable, revealFolder, searchFolders,
} from './core/tree.js';
import type { Favorites } from './core/favorites.js';
import { loadFavorites, saveFavorites, toggleConversation, toggleFolder } from './core/favorites.js';
import { loadConfig } from './core/config.js';
import type { LaunchRequest } from './core/launcher.js';
import { runInNewTab } from './core/launcher.js';
import { csesCommand, encodeSpec, panelWanted } from './core/supervisor.js';
import { dateGroup, matchesQuery, shortDate } from './core/format.js';
import { isInside, lastSegment, normalizePath, shortPath } from './core/paths.js';
import { t } from './i18n.js';
import type { Messages } from './i18n.js';
import { fit, fitLeft } from './ui/text.js';
import { getStringWidth } from './utils/charWidth.js';
import { Lines } from './ui/Lines.js';
import { useTerminalSize } from './ui/useTerminalSize.js';
import type { AccountHint, PreviewContent } from './ui/preview.js';
import { allPreview, folderPreview, sessionPreview } from './ui/preview.js';
import type { MouseEvent } from './ui/input.js';
import { ACCENT, ERROR, FOLDER, MUTED, OK, WARN, line } from './ui/theme.js';
import type { Line } from './ui/theme.js';

export const FOLDERS = 0;
export const CONVS = 1;
export const PREVIEW = 2;
export type Focus = typeof FOLDERS | typeof CONVS | typeof PREVIEW;

export interface AppProps {
  extraArgs: string[];
  initialFolder: string | null;
  initialFocus?: Focus;
  // Se llama justo antes de salir cuando hay que abrir claude en esta terminal
  onLaunch: (req: LaunchRequest) => void;
  // Eventos del ratón, si la terminal los manda
  mouse?: EventEmitter | null;
}

type Queries = { carpetas: string; conversaciones: string };
type QueryTarget = keyof Queries;
// Una posición a la que se puede volver con esc
interface View {
  folderKey: string;
  convId: string | null;
  focus: Focus;
  queries: Queries;
  expanded: string[];
}
type Status = { texto: string; color: string } | null;
type Confirm = { req: LaunchRequest; enPestana: boolean; running: RunningSession } | null;
type ConvRow = { kind: 'group'; label: string } | { kind: 'item'; index: number };

const WIDE_LAYOUT_MIN_COLS = 130;
const STATUS_MS = 4000;
const RUNNING_REFRESH_MS = 4000;
const DOUBLE_CLICK_MS = 450;
const HISTORY_MAX = 50;
const DATE_W = 6;
// Filas de pantalla (desde 1): barra, búsqueda, borde de los paneles y título de columna
const PANELS_Y = 3;
const LIST_Y = PANELS_Y + 2;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// Primera fila visible de una lista para que la seleccionada quede a la vista; si es la
// primera de su grupo, que se vea también el título del grupo
function scrollTop(prev: number, selRow: number, height: number, total: number, isGroup: (i: number) => boolean): number {
  let top = prev;
  if (selRow < top) top = selRow;
  if (selRow >= top + height) top = selRow - height + 1;
  if (top > 0 && top === selRow && isGroup(top - 1)) top -= 1;
  return clamp(top, 0, Math.max(0, total - height));
}

function sessionHaystack(s: SessionRecord): string {
  return [titleOf(s), shortPath(s.cwd ?? ''), s.branch ?? '', s.primero ?? '', ...s.ultimos.filter(x => x.rol === 'tu').map(x => x.texto)].join(' ');
}

function inFolder(s: SessionRecord, row: FolderRow): boolean {
  if (!s.cwd) return false;
  return row.exact ? normalizePath(s.cwd) === normalizePath(row.path) : isInside(s.cwd, row.path);
}

const App: React.FC<AppProps> = ({ extraArgs, initialFolder, initialFocus = CONVS, onLaunch, mouse }) => {
  const { exit } = useApp();
  const { cols, rows } = useTerminalSize();
  const accounts = useMemo(() => getAccounts(), []);
  const raices = useMemo(() => loadConfig().raices ?? [], []);

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [running, setRunning] = useState<Map<string, RunningSession>>(new Map());
  const [favs, setFavs] = useState<Favorites>(loadFavorites);

  const [focus, setFocus] = useState<Focus>(initialFocus);
  const [queries, setQueries] = useState<Queries>({ carpetas: '', conversaciones: '' });
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selFolderKey, setSelFolderKey] = useState<string>(TODAS);
  const [convId, setConvId] = useState<string | null>(null);
  // Primera fila visible de cada lista
  const [folderTop, setFolderTop] = useState(0);
  const [convTop, setConvTop] = useState(0);
  // Líneas desde el final de la vista previa
  const [previewOff, setPreviewOff] = useState(0);
  const [override, setOverride] = useState<Account | null>(null);
  const [status, setStatusState] = useState<Status>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [history, setHistory] = useState<View[]>([]);
  // Dónde se estaba al entrar en la columna de carpetas: esc vuelve ahí
  const [anchor, setAnchor] = useState<View | null>(null);
  const statusTimer = useRef<NodeJS.Timeout | null>(null);
  const lastClick = useRef<{ x: number; y: number; at: number } | null>(null);
  const revealed = useRef(false);

  const setStatus = useCallback((s: Status) => {
    setStatusState(s);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    if (s) statusTimer.current = setTimeout(() => setStatusState(null), STATUS_MS);
  }, []);

  const reload = useCallback(() =>
    updateIndex(accounts, p => setProgress(p))
      .then(all => {
        const visible = visibleSessions(all);
        clearSubdirCache();
        setSessions(visible);
        setRunning(runningSessions(accounts));
        if (initialFolder && !revealed.current) {
          revealed.current = true;
          const r = revealFolder(initialFolder, buildFolderIndex(visible), raices);
          setExpanded(r.expand);
          setSelFolderKey(r.key);
        }
      })
      .catch(err => setError((err as Error).message))
      .finally(() => {
        setLoading(false);
        setProgress(null);
      }), [accounts, initialFolder, raices]);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => setRunning(runningSessions(accounts)), RUNNING_REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload, accounts]);

  // ── Columna de carpetas ────────────────────────────────────────────────
  const idx = useMemo(() => buildFolderIndex(sessions), [sessions]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const treeRows = useMemo<TreeRow[]>(
    () => (queries.carpetas
      ? searchFolders(idx, raices, queries.carpetas, favs.carpetas)
      : buildTree(idx, raices, expandedSet, favs.carpetas, sessions.length)),
    [idx, raices, queries.carpetas, favs.carpetas, expandedSet, sessions.length],
  );
  let folderIdx = treeRows.findIndex(r => r.kind !== 'grupo' && r.key === selFolderKey);
  if (folderIdx < 0) folderIdx = treeRows.findIndex(isSelectable);
  const folderRow = folderIdx >= 0 ? treeRows[folderIdx] : undefined;
  const filterRow = folderRow?.kind === 'carpeta' ? folderRow : null;
  const currentFolderKey = folderRow && folderRow.kind !== 'grupo' ? folderRow.key : TODAS;

  // ── Columna de conversaciones ──────────────────────────────────────────
  const haystacks = useMemo(() => new Map(sessions.map(s => [s.id, sessionHaystack(s)])), [sessions]);
  const convFiltered = useMemo(
    () => sessions.filter(s => (!filterRow || inFolder(s, filterRow)) && matchesQuery(haystacks.get(s.id) ?? '', queries.conversaciones)),
    [sessions, filterRow, haystacks, queries.conversaciones],
  );
  const { convItems, convRows } = useMemo(() => {
    const pinnedIds = new Set(favs.conversaciones);
    const pinned = convFiltered.filter(s => pinnedIds.has(s.id));
    const rest = convFiltered.filter(s => !pinnedIds.has(s.id));
    const out: ConvRow[] = [];
    if (pinned.length) {
      out.push({ kind: 'group', label: t('favorites') });
      pinned.forEach((_, i) => out.push({ kind: 'item', index: i }));
    }
    let last = '';
    rest.forEach((s, j) => {
      const g = dateGroup(s.mtime);
      if (g !== last) {
        out.push({ kind: 'group', label: g });
        last = g;
      }
      out.push({ kind: 'item', index: pinned.length + j });
    });
    return { convItems: [...pinned, ...rest], convRows: out };
  }, [convFiltered, favs.conversaciones]);
  const rowOfItem = useMemo(() => {
    const m = new Map<number, number>();
    convRows.forEach((r, i) => {
      if (r.kind === 'item') m.set(r.index, i);
    });
    return m;
  }, [convRows]);
  let convIdx = convId ? convItems.findIndex(s => s.id === convId) : -1;
  if (convIdx < 0) convIdx = 0;
  const selectedSession: SessionRecord | undefined = convItems[convIdx];
  const mixedFolders = useMemo(() => new Set(convItems.map(s => normalizePath(s.cwd ?? ''))).size > 1, [convItems]);

  // ── Geometría ──────────────────────────────────────────────────────────
  const wide = cols >= WIDE_LAYOUT_MIN_COLS;
  // Una fila menos que la terminal: si Ink llena la pantalla entera, la borra en cada repintado
  const panelsH = Math.max(10, rows - 1 - 3);
  const folderW = wide ? clamp(Math.floor(cols * 0.24), 26, 42) : Math.max(22, Math.floor(cols * 0.36));
  const convW = wide ? clamp(Math.floor(cols * 0.38), 40, 72) : cols - folderW;
  const previewW = wide ? cols - folderW - convW : cols;
  const topH = wide ? panelsH : Math.max(8, Math.floor(panelsH * 0.55));
  const previewH = wide ? panelsH : panelsH - topH;
  const listRowsH = Math.max(1, topH - 3);
  const previewInnerH = Math.max(1, previewH - 3);
  const inner = (w: number) => Math.max(4, w - 4);

  const shownFolderTop = scrollTop(folderTop, Math.max(0, folderIdx), listRowsH, treeRows.length, i => treeRows[i]?.kind === 'grupo');
  const convScroll = (prev: number, selRow: number) =>
    scrollTop(prev, selRow, listRowsH, convRows.length, i => convRows[i]?.kind === 'group');
  const shownConvTop = convScroll(convTop, rowOfItem.get(convIdx) ?? 0);

  // ── Selección ──────────────────────────────────────────────────────────
  const selectFolderAt = (i: number, dir: 1 | -1 = 1) => {
    let j = clamp(i, 0, treeRows.length - 1);
    while (j >= 0 && j < treeRows.length && !isSelectable(treeRows[j])) j += dir;
    if (j < 0 || j >= treeRows.length) return;
    const row = treeRows[j];
    if (row.kind === 'grupo') return;
    setSelFolderKey(row.key);
    setFolderTop(scrollTop(shownFolderTop, j, listRowsH, treeRows.length, k => treeRows[k]?.kind === 'grupo'));
    setConvTop(0);
    setPreviewOff(0);
  };
  const moveFolder = (delta: number) => selectFolderAt(folderIdx + delta, delta >= 0 ? 1 : -1);

  const selectConvAt = (i: number) => {
    if (convItems.length === 0) return;
    const n = clamp(i, 0, convItems.length - 1);
    setConvId(convItems[n].id);
    setConvTop(convScroll(shownConvTop, rowOfItem.get(n) ?? 0));
    setPreviewOff(0);
  };

  const currentView = (): View => ({ folderKey: currentFolderKey, convId: selectedSession?.id ?? null, focus, queries, expanded });

  const restoreView = (v: View) => {
    setSelFolderKey(v.folderKey);
    setConvId(v.convId);
    setFocus(v.focus);
    setQueries(v.queries);
    setExpanded(v.expanded);
    setFolderTop(0);
    setConvTop(0);
    setPreviewOff(0);
    setAnchor(null);
  };

  const pushHistory = (v: View) => setHistory(h => [...h.slice(-(HISTORY_MAX - 1)), v]);

  const changeFocus = (f: Focus) => {
    if (f === focus) return;
    if (focus === FOLDERS && anchor && anchor.folderKey !== currentFolderKey) pushHistory(anchor);
    setAnchor(f === FOLDERS ? currentView() : null);
    setFocus(f);
  };

  const reveal = (path: string) => {
    const r = revealFolder(path, idx, raices);
    setExpanded(e => [...new Set([...e, ...r.expand])]);
    setSelFolderKey(r.key);
    setFolderTop(0);
  };

  const setQuery = (target: QueryTarget, value: string) => {
    // Al dejar de buscar carpetas, la elegida se enseña en su sitio del árbol
    if (target === 'carpetas' && !value && queries.carpetas && filterRow) reveal(filterRow.path);
    setQueries(q => ({ ...q, [target]: value }));
    if (target === 'conversaciones') {
      setConvId(null);
      setConvTop(0);
    } else {
      setFolderTop(0);
    }
    setPreviewOff(0);
  };

  const queryTarget: QueryTarget = focus === FOLDERS ? 'carpetas' : 'conversaciones';

  const goToFolderOf = (s: SessionRecord) => {
    if (!s.cwd) return;
    pushHistory(currentView());
    setQueries(q => ({ ...q, carpetas: '' }));
    reveal(s.cwd);
    setConvId(s.id);
    setFocus(FOLDERS);
    setAnchor(null);
  };

  const goBack = () => {
    if (queries[queryTarget]) {
      setQuery(queryTarget, '');
    } else if (focus === FOLDERS && anchor && anchor.folderKey !== currentFolderKey) {
      restoreView(anchor);
    } else if (history.length) {
      const v = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      restoreView(v);
    } else if (focus !== CONVS) {
      changeFocus(CONVS);
    } else {
      exit();
    }
  };

  // ── Cuenta con la que se abriría lo seleccionado ───────────────────────
  const resolveAccount = (folder: string | null, sessionRoot: string | null): { account: Account; hint: AccountHint } => {
    let account: Account;
    let origen: string;
    if (override) {
      account = override;
      origen = t('accountChosen');
    } else {
      const byRule = folder ? accountForFolder(folder, accounts) : null;
      account = byRule ?? defaultAccount(accounts);
      origen = byRule ? t('accountByFolder') : t('accountDefault');
    }
    const avisos: string[] = [];
    if (sessionRoot && account.projectsReal !== sessionRoot) {
      const owner = accounts.find(a => a.projectsReal === sessionRoot);
      if (owner) {
        avisos.push(t('warnNotShared', { a: account.nombre, b: owner.nombre }));
        account = owner;
      }
    }
    if (!account.conSesion) avisos.push(t('warnNoLogin', { a: account.nombre }));
    return {
      account,
      hint: { texto: `${account.nombre}${account.email ? ` · ${account.email}` : ''}  (${origen})`, aviso: avisos.join('. ') || undefined },
    };
  };

  const cycleAccount = () => {
    const i = override ? accounts.findIndex(a => a.nombre === override.nombre) : -1;
    const next = i + 1 < accounts.length ? accounts[i + 1] : null;
    setOverride(next);
    setStatus({
      texto: next ? t('statusAccount', { label: `${next.nombre}${next.email ? ` · ${next.email}` : ''}` }) : t('statusAccountAuto'),
      color: ACCENT,
    });
  };

  // ── Lanzar ─────────────────────────────────────────────────────────────
  const launch = (req: LaunchRequest, enPestana: boolean, confirmed = false) => {
    if (!existsSync(req.cwd)) {
      setStatus({ texto: t('statusFolderMissing', { path: req.cwd }), color: ERROR });
      return;
    }
    const open = req.sessionId ? running.get(req.sessionId) : undefined;
    if (open && !req.fork && !confirmed) {
      setConfirm({ req, enPestana, running: open });
      return;
    }
    if (enPestana) {
      // Con el panel de cuentas, en la pestaña va «cses _run», que lo pone al lado de claude
      const r = runInNewTab(req, panelWanted(accounts) ? csesCommand(['_run', encodeSpec(req)]) : undefined);
      const vars = { title: req.titulo, account: req.account.nombre };
      if (r.ok) {
        const key: keyof Messages = r.donde === 'pestana' ? 'statusTabOpened' : r.donde === 'ventana' ? 'statusWindowOpened' : 'statusTmuxOpened';
        setStatus({ texto: t(key, vars), color: OK });
      } else {
        setStatus({ texto: r.error ? t('statusOpenFailed', { msg: r.error }) : t('statusNoTabs'), color: ERROR });
      }
      setTimeout(() => setRunning(runningSessions(accounts)), 3000);
      return;
    }
    onLaunch(req);
    exit();
  };

  const sessionRequest = (s: SessionRecord, fork = false): LaunchRequest => ({
    cwd: s.cwd as string,
    account: resolveAccount(s.cwd, s.projectsReal).account,
    sessionId: s.id,
    fork,
    extraArgs,
    titulo: fork ? t('forkTitle', { title: titleOf(s) }) : titleOf(s),
  });

  const newRequest = (cwd: string): LaunchRequest => ({
    cwd,
    account: resolveAccount(cwd, null).account,
    extraArgs,
    titulo: t('newTitle', { name: lastSegment(cwd) }),
  });

  // Carpeta para una conversación nueva: la elegida en el árbol o la de la conversación
  const newConversation = (enPestana: boolean) => {
    const cwd = filterRow?.path ?? (focus !== FOLDERS ? selectedSession?.cwd : null);
    if (!cwd) {
      setStatus({ texto: t('statusPickFolder'), color: WARN });
      return;
    }
    launch(newRequest(cwd), enPestana);
  };

  const toggleFavorite = () => {
    let next: Favorites;
    let added: boolean;
    if (focus === FOLDERS) {
      if (!filterRow) return;
      next = toggleFolder(favs, filterRow.path);
      added = next.carpetas.length > favs.carpetas.length;
    } else {
      if (!selectedSession) return;
      next = toggleConversation(favs, selectedSession.id);
      added = next.conversaciones.length > favs.conversaciones.length;
    }
    saveFavorites(next);
    setFavs(next);
    setStatus({ texto: added ? t('statusFavAdded') : t('statusFavRemoved'), color: ACCENT });
  };

  const scrollPreview = (delta: number) => setPreviewOff(o => Math.max(0, o + delta));

  // ── Teclado ────────────────────────────────────────────────────────────
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }
    if (loading || error) {
      if (key.escape) exit();
      return;
    }
    if (confirm) {
      if (input === 'f' || input === 'F') {
        setConfirm(null);
        launch({ ...confirm.req, fork: true, titulo: t('forkTitle', { title: confirm.req.titulo }) }, confirm.enPestana);
      } else if (key.return) {
        setConfirm(null);
        launch(confirm.req, confirm.enPestana, true);
      } else if (key.escape) {
        setConfirm(null);
      }
      return;
    }

    if (key.ctrl) {
      const s = selectedSession;
      switch (input) {
        case 't':
          if (focus === FOLDERS) newConversation(true);
          else if (s) launch(sessionRequest(s), true);
          break;
        case 'n':
          newConversation(false);
          break;
        case 'f':
          if (s) launch(sessionRequest(s, true), false);
          break;
        case 'a':
          cycleAccount();
          break;
        case 'e':
          toggleFavorite();
          break;
        case 'g':
          if (s) goToFolderOf(s);
          break;
        case 'y':
          if (s) {
            try {
              clipboardy.writeSync(s.id);
              setStatus({ texto: t('statusCopied', { id: s.id }), color: OK });
            } catch {
              setStatus({ texto: t('statusCopyFailed'), color: ERROR });
            }
          }
          break;
        case 'r':
          setStatus({ texto: t('statusRefreshing'), color: MUTED });
          void reload().then(() => setStatus({ texto: t('statusRefreshed'), color: OK }));
          break;
      }
      return;
    }

    if (key.escape) {
      goBack();
      return;
    }
    if (key.tab) {
      changeFocus(((focus + (key.shift ? 2 : 1)) % 3) as Focus);
      return;
    }
    const page = Math.max(1, listRowsH - 2);

    if (focus === FOLDERS) {
      if (key.upArrow) moveFolder(-1);
      else if (key.downArrow) moveFolder(1);
      else if (key.pageUp) moveFolder(-page);
      else if (key.pageDown) moveFolder(page);
      else if (key.rightArrow) {
        if (filterRow?.expandible && !filterRow.expandido) setExpanded(e => [...e, normalizePath(filterRow.path)]);
        else changeFocus(CONVS);
      } else if (key.leftArrow) {
        if (filterRow?.expandido) {
          const k = normalizePath(filterRow.path);
          setExpanded(e => e.filter(x => x !== k));
        } else if (filterRow && filterRow.depth > 0) {
          setSelFolderKey(folderKey(dirname(filterRow.path)));
        }
      } else if (key.return) {
        changeFocus(CONVS);
      }
    } else if (focus === CONVS) {
      if (key.upArrow) selectConvAt(convIdx - 1);
      else if (key.downArrow) selectConvAt(convIdx + 1);
      else if (key.pageUp) selectConvAt(convIdx - page);
      else if (key.pageDown) selectConvAt(convIdx + page);
      else if (key.leftArrow) changeFocus(FOLDERS);
      else if (key.rightArrow) changeFocus(PREVIEW);
      else if (key.return && selectedSession) launch(sessionRequest(selectedSession), false);
    } else {
      if (key.upArrow) scrollPreview(1);
      else if (key.downArrow) scrollPreview(-1);
      else if (key.pageUp) scrollPreview(Math.max(1, previewInnerH - 2));
      else if (key.pageDown) scrollPreview(-Math.max(1, previewInnerH - 2));
      else if (key.leftArrow) changeFocus(CONVS);
      else if (key.return && selectedSession) launch(sessionRequest(selectedSession), false);
    }
    if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.pageUp || key.pageDown || key.return) return;

    if (key.backspace || key.delete) {
      if (queries[queryTarget]) setQuery(queryTarget, queries[queryTarget].slice(0, -1));
      return;
    }
    // Lo demás se escribe en el buscador de la columna
    // eslint-disable-next-line no-control-regex -- fuera los caracteres de control de lo pegado
    const typed = input.replace(/[\x00-\x1f\x7f]/g, '');
    if (typed && !key.meta) {
      if (focus === PREVIEW) setFocus(CONVS);
      setQuery(queryTarget, queries[queryTarget] + typed);
    }
  });

  // ── Ratón ──────────────────────────────────────────────────────────────
  const columnAt = (x: number, y: number): Focus | null => {
    if (y < PANELS_Y) return null;
    if (wide) return x <= folderW ? FOLDERS : x <= folderW + convW ? CONVS : PREVIEW;
    if (y >= PANELS_Y + topH) return PREVIEW;
    return x <= folderW ? FOLDERS : CONVS;
  };

  const onMouse = (ev: MouseEvent) => {
    if (loading || error || confirm) return;
    const col = columnAt(ev.x, ev.y);
    if (col === null) return;
    if (ev.tipo !== 'clic') {
      const delta = ev.tipo === 'rueda-arriba' ? -3 : 3;
      if (col === FOLDERS) moveFolder(delta);
      else if (col === CONVS) selectConvAt(convIdx + delta);
      else scrollPreview(-delta);
      return;
    }
    const prev = lastClick.current;
    const now = Date.now();
    const double = !!prev && now - prev.at < DOUBLE_CLICK_MS && Math.abs(prev.x - ev.x) <= 1 && prev.y === ev.y;
    lastClick.current = { x: ev.x, y: ev.y, at: now };
    changeFocus(col);
    const listRow = ev.y - LIST_Y;
    if (listRow < 0 || listRow >= listRowsH) return;
    if (col === FOLDERS) {
      const i = shownFolderTop + listRow;
      const row = treeRows[i];
      if (!row || row.kind === 'grupo') return;
      selectFolderAt(i);
      if (double && row.kind === 'carpeta' && row.expandible) {
        const k = normalizePath(row.path);
        setExpanded(e => (e.includes(k) ? e.filter(x => x !== k) : [...e, k]));
      }
    } else if (col === CONVS) {
      const row = convRows[shownConvTop + listRow];
      if (!row || row.kind !== 'item') return;
      selectConvAt(row.index);
      if (double) launch(sessionRequest(convItems[row.index]), false);
    }
  };

  useEffect(() => {
    if (!mouse) return undefined;
    mouse.on('mouse', onMouse);
    return () => {
      mouse.off('mouse', onMouse);
    };
  });

  // ── Pantallas de carga y error ─────────────────────────────────────────
  if (loading || error) {
    const pct = progress && progress.total ? Math.round((progress.hechos / progress.total) * 100) : 0;
    const barW = Math.min(40, cols - 10);
    const filled = Math.round((barW * pct) / 100);
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text>
          <Text color={ACCENT} bold>✻ cses</Text>
          <Text dimColor>  {t('tagline')}</Text>
        </Text>
        {error ? (
          <Text color={ERROR}>{t('error', { msg: error })}</Text>
        ) : (
          <>
            <Text> </Text>
            <Text dimColor>
              {progress && progress.total > 3
                ? t('indexing', { n: progress.hechos, total: progress.total, mb: Math.round(progress.bytes / 1048576) })
                : t('reading')}
            </Text>
            {progress && progress.total > 3 && (
              <Text>
                <Text color={ACCENT}>{'█'.repeat(filled)}</Text>
                <Text color={MUTED}>{'░'.repeat(barW - filled)}</Text>
                <Text dimColor> {pct}%</Text>
              </Text>
            )}
          </>
        )}
      </Box>
    );
  }

  // ── Columna de carpetas ────────────────────────────────────────────────
  const pointer = (sel: boolean, focused: boolean) => ({ t: sel ? '▌' : ' ', color: focused ? ACCENT : MUTED });
  const fw = inner(folderW);
  const folderLines: Line[] = [];
  for (const [i, row] of treeRows.slice(shownFolderTop, shownFolderTop + listRowsH).entries()) {
    if (row.kind === 'grupo') {
      folderLines.push(line({ t: fit(row.label, fw), color: ACCENT, dim: true }));
      continue;
    }
    const sel = shownFolderTop + i === folderIdx;
    const hot = sel && focus === FOLDERS;
    const count = row.conversaciones ? String(row.conversaciones) : '';
    if (row.kind === 'todas') {
      folderLines.push(line(pointer(sel, focus === FOLDERS), { t: fit(` ${t('all')}`, fw - 1 - 5), bold: sel, color: hot ? 'white' : undefined }, { t: fit(count, 5, 'right'), dim: true }));
      continue;
    }
    const arrow = row.expandible ? (row.expandido ? '▾' : '▸') : ' ';
    const star = row.favorito && !row.key.startsWith('f:') ? ' ★' : '';
    const indent = '  '.repeat(row.depth);
    const labelW = Math.max(4, fw - 1 - indent.length - 2 - 5);
    const label = row.label + star;
    // En los resultados de búsqueda, el nombre y detrás, en gris, dónde está
    const detalleW = Math.max(0, labelW - getStringWidth(label) - 1);
    const detalle = row.detalle && detalleW > 3 ? ` ${fitLeft(row.detalle, detalleW)}` : '';
    folderLines.push(line(
      pointer(sel, focus === FOLDERS),
      { t: indent },
      { t: row.existe ? `${arrow} ` : '✗ ', color: row.existe ? MUTED : ERROR },
      {
        t: row.detalle ? fit(label, labelW - getStringWidth(detalle))
          : row.depth === 0 && !row.exact ? fitLeft(label, labelW) : fit(label, labelW),
        bold: sel,
        color: hot ? 'white' : row.conversaciones ? FOLDER : undefined,
        dim: !sel && row.conversaciones === 0,
      },
      { t: detalle, dim: true },
      { t: fit(count, 5, 'right'), dim: true },
    ));
  }
  if (treeRows.length === 0) folderLines.push(line({ t: ` ${t('noMatches')}`, dim: true }));

  // ── Columna de conversaciones ──────────────────────────────────────────
  const cw = inner(convW);
  const convLines: Line[] = [];
  const folderSegW = mixedFolders ? Math.min(18, Math.max(8, Math.floor(cw * 0.28))) : 0;
  const titleW = Math.max(8, cw - 3 - (folderSegW ? folderSegW + 1 : 0) - DATE_W - 1);
  for (const row of convRows.slice(shownConvTop, shownConvTop + listRowsH)) {
    if (row.kind === 'group') {
      convLines.push(line({ t: fit(row.label, cw), color: ACCENT, dim: true }));
      continue;
    }
    const s = convItems[row.index];
    const sel = row.index === convIdx;
    const hot = sel && focus !== FOLDERS;
    convLines.push(line(
      pointer(sel, focus !== FOLDERS),
      { t: running.has(s.id) ? '● ' : '  ', color: OK },
      { t: fit(titleOf(s), titleW), bold: sel, color: hot ? 'white' : undefined },
      ...(folderSegW ? [' ', { t: fitLeft(s.cwd ? lastSegment(s.cwd) : '', folderSegW), color: FOLDER, dim: !sel }] : []),
      ' ',
      { t: fit(shortDate(s.mtime), DATE_W, 'right'), dim: true },
    ));
  }
  if (convItems.length === 0) convLines.push(line({ t: ` ${t('noMatches')}`, dim: true }));

  // ── Vista previa ───────────────────────────────────────────────────────
  const pw = inner(previewW);
  let preview: PreviewContent = { header: [line({ t: t('nothingSelected'), dim: true })], body: [] };
  if (focus === FOLDERS && folderRow?.kind === 'todas') {
    preview = allPreview(sessions, idx.cwds.size, pw, running, resolveAccount(null, null).hint);
  } else if (focus === FOLDERS && filterRow) {
    preview = folderPreview(filterRow, pw, sessions, running, resolveAccount(filterRow.path, null).hint);
  } else if (selectedSession) {
    preview = sessionPreview(selectedSession, pw, running.get(selectedSession.id), resolveAccount(selectedSession.cwd, selectedSession.projectsReal).hint);
  }
  const header = preview.header.slice(0, previewInnerH);
  const bodyH = Math.max(0, previewInnerH - header.length);
  const off = Math.min(previewOff, Math.max(0, preview.body.length - bodyH));
  const start = Math.max(0, preview.body.length - bodyH - off);
  const body = preview.body.slice(start, start + bodyH);
  if (start > 0 && body.length > 0) body[0] = line({ t: `  ${t('moreAbove', { n: start })}`, dim: true });

  // ── Barras ─────────────────────────────────────────────────────────────
  const shown = focus === FOLDERS
    ? resolveAccount(filterRow?.path ?? null, null).account
    : resolveAccount(selectedSession?.cwd ?? null, selectedSession?.projectsReal ?? null).account;
  const accountText = `${shown.nombre}${shown.email ? ` · ${shown.email}` : ''}`;
  const extra = extraArgs.length ? `  + ${extraArgs.join(' ')}` : '';
  const query = queries[queryTarget];
  const otherTarget: QueryTarget = queryTarget === 'carpetas' ? 'conversaciones' : 'carpetas';
  const otherQuery = queries[otherTarget];

  const hints: Array<[string, keyof Messages]> = confirm
    ? [['f', 'kForkOpen'], ['↵', 'kOpenAnyway'], ['esc', 'kCancel']]
    : focus === FOLDERS
      ? [['→', filterRow?.expandible && !filterRow.expandido ? 'kExpand' : 'kColumn'], ['↵', 'colConvs'], ['^N', 'kNew'], ['^T', 'kTab'], ['^E', 'kFav'], ['^A', 'kAccount'], ['esc', query ? 'kSearchClear' : 'kBack']]
      : focus === CONVS
        ? [['↵', 'kOpen'], ['^T', 'kTab'], ['^N', 'kNew'], ['^F', 'kFork'], ['^E', 'kFav'], ['^G', 'kGoFolder'], ['^A', 'kAccount'], ['esc', query ? 'kSearchClear' : 'kBack']]
        : [['↑↓', 'kScroll'], ['↵', 'kOpen'], ['←', 'kColumn'], ['esc', 'kBack']];

  const column = (title: string, focused: boolean, w: number, h: number, lines: Line[]) => (
    <Box borderStyle="round" borderColor={focused ? ACCENT : MUTED} width={w} height={h} paddingX={1} flexDirection="column">
      <Text wrap="truncate" bold={focused} color={focused ? ACCENT : undefined} dimColor={!focused}>{fit(title, inner(w))}</Text>
      <Lines lines={lines} />
    </Box>
  );

  const convTitle = `${filterRow ? t('inFolder', { path: shortPath(filterRow.path) }) : t('all')} · ${
    queries.conversaciones ? t('countOf', { n: convItems.length, total: sessions.length }) : convItems.length}`;

  const foldersCol = column(t('colFolders'), focus === FOLDERS, folderW, topH, folderLines);
  const convsCol = column(convTitle, focus !== FOLDERS && focus !== PREVIEW, convW, topH, convLines);
  const previewCol = column(t('colPreview'), focus === PREVIEW, previewW, previewH, [...header, ...body]);

  return (
    <Box flexDirection="column" width={cols} height={rows - 1}>
      <Box width={cols} paddingX={1}>
        <Text wrap="truncate">
          <Text color={ACCENT} bold>✻ cses</Text>
          <Text color={WARN}>{extra}</Text>
        </Text>
        <Box flexGrow={1} />
        <Text wrap="truncate">
          <Text dimColor>{t('account')}</Text>
          <Text color={shown.conSesion ? OK : WARN}>{fit(accountText, Math.max(10, cols - 30 - extra.length)).trimEnd()}</Text>
          <Text dimColor>{override ? '' : ' ·auto'}</Text>
        </Text>
      </Box>
      <Box width={cols} paddingX={1}>
        <Text wrap="truncate">
          <Text color={ACCENT}> ⌕ </Text>
          {query ? <Text>{query}</Text> : null}
          <Text color={ACCENT}>▏</Text>
          {query ? null : <Text dimColor>{queryTarget === 'carpetas' ? t('searchFolders') : t('searchConvs')}</Text>}
          {otherQuery ? <Text dimColor>{`   · ${otherTarget === 'carpetas' ? t('colFolders') : t('colConvs')}: ${otherQuery}`}</Text> : null}
        </Text>
      </Box>
      {wide ? (
        <Box flexDirection="row">
          {foldersCol}
          {convsCol}
          {previewCol}
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box flexDirection="row">
            {foldersCol}
            {convsCol}
          </Box>
          {previewCol}
        </Box>
      )}
      <Box width={cols} paddingX={1}>
        {status && !confirm ? (
          <Text wrap="truncate" color={status.color}>{status.texto}</Text>
        ) : (
          <Text wrap="truncate">
            {confirm ? <Text color={WARN}>{t('confirmOpen', { account: confirm.running.cuenta })}</Text> : null}
            {hints.map(([k, label]) => (
              <Text key={k + label}><Text color={ACCENT} bold>{k}</Text><Text dimColor> {t(label)}  </Text></Text>
            ))}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default App;
