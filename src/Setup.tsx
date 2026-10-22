import React, { useEffect, useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import type { EventEmitter } from 'events';
import { existsSync } from 'fs';
import type { Account } from './core/accounts.js';
import { getAccounts } from './core/accounts.js';
import { createAccount } from './core/accountAdmin.js';
import type { CcsConfig } from './core/config.js';
import { loadConfig, saveConfig } from './core/config.js';
import type { AuthStatus } from './core/launcher.js';
import { authStatus } from './core/launcher.js';
import { expandHome, normalizePath, tildePath } from './core/paths.js';
import type { Lang } from './i18n.js';
import { detectLang, setLang, t } from './i18n.js';
import { Lines } from './ui/Lines.js';
import type { MouseEvent } from './ui/input.js';
import { fit, wrap } from './ui/text.js';
import type { Line } from './ui/theme.js';
import { ACCENT, ERROR, FOLDER, MUTED, OK, WARN, line } from './ui/theme.js';
import { useTerminalSize } from './ui/useTerminalSize.js';

export type SetupAction = { kind: 'login' | 'logout'; cuenta: string };

interface SetupProps {
  welcome: boolean;
  mouse: EventEmitter | null;
  onAction: (action: SetupAction) => void;
}

type PrefKey = 'cuentaPorDefecto' | 'idioma' | 'panelCuentas' | 'raton' | 'terminal';
type Row =
  | { kind: 'cuenta'; nombre: string }
  | { kind: 'nuevaCuenta' }
  | { kind: 'pref'; key: PrefKey }
  | { kind: 'raiz'; index: number }
  | { kind: 'nuevaRaiz' }
  | { kind: 'regla'; index: number }
  | { kind: 'nuevaRegla' };
type Input = { kind: 'cuenta' | 'raiz' | 'regla'; text: string } | null;
type Msg = { texto: string; color?: string } | null;

const rowKey = (r: Row): string => {
  switch (r.kind) {
    case 'cuenta': return `cuenta:${r.nombre}`;
    case 'pref': return `pref:${r.key}`;
    case 'raiz': return `raiz:${r.index}`;
    case 'regla': return `regla:${r.index}`;
    default: return r.kind;
  }
};

// Cada preferencia, con sus valores posibles; «undefined» es «automático»
interface PrefOption<T> { value: T; label: () => string }
function prefOptions(key: PrefKey, accounts: Account[]): Array<PrefOption<unknown>> {
  const auto = { value: undefined, label: () => t('setupAuto') };
  switch (key) {
    case 'cuentaPorDefecto':
      return [auto, ...accounts.map(a => ({ value: a.nombre, label: () => a.nombre }))];
    case 'idioma':
      return [auto, { value: 'es', label: () => 'Español' }, { value: 'en', label: () => 'English' }];
    case 'panelCuentas':
      return [auto, { value: true, label: () => t('setupYes') }, { value: false, label: () => t('setupNo') }];
    case 'raton':
      return [{ value: true, label: () => t('setupYes') }, { value: false, label: () => t('setupNo') }];
    case 'terminal':
      return [auto, { value: 'wt', label: () => 'Windows Terminal' }, { value: 'ventana', label: () => t('setupTermWindow') }, { value: 'tmux', label: () => 'tmux' }];
  }
}

const PREF_LABEL: Record<PrefKey, 'setupDefaultAccount' | 'setupLanguage' | 'setupPanel' | 'setupMouse' | 'setupTerminal'> = {
  cuentaPorDefecto: 'setupDefaultAccount',
  idioma: 'setupLanguage',
  panelCuentas: 'setupPanel',
  raton: 'setupMouse',
  terminal: 'setupTerminal',
};

const prefValue = (cfg: CcsConfig, key: PrefKey): unknown => (key === 'raton' ? cfg.raton ?? true : cfg[key]);

// Filas de pantalla (desde 1) antes de la lista: título y línea en blanco
const BODY_Y = 3;

const Setup: React.FC<SetupProps> = ({ welcome, mouse, onAction }) => {
  const { exit } = useApp();
  const { cols, rows } = useTerminalSize();
  const [cfg, setCfg] = useState<CcsConfig>(() => ({ ...loadConfig() }));
  const [accounts, setAccounts] = useState<Account[]>(() => getAccounts(true));
  const [status, setStatus] = useState<Record<string, AuthStatus | null | undefined>>({});
  const [selKey, setSelKey] = useState<string | null>(null);
  const [input, setInput] = useState<Input>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [confirmLogout, setConfirmLogout] = useState<string | null>(null);

  // Email y plan de cada cuenta, preguntándoselo a claude (tarda un poco: va aparte)
  useEffect(() => {
    let alive = true;
    for (const a of accounts) {
      void authStatus(a).then(s => {
        if (alive) setStatus(prev => ({ ...prev, [a.nombre]: s }));
      });
    }
    return () => {
      alive = false;
    };
  }, [accounts]);

  const update = (next: CcsConfig) => {
    const saved = { ...next, configurado: true };
    saveConfig(saved);
    setCfg(saved);
  };

  // ── Filas ─────────────────────────────────────────────────────────────
  const lines: Line[] = [];
  const lineRow: Array<Row | undefined> = [];
  const selectable: Row[] = [];
  const width = Math.max(40, cols - 1);
  const push = (l: Line, row?: Row) => {
    lines.push(l);
    lineRow.push(row);
  };
  const section = (title: string, intro?: string) => {
    push(line({ t: ` ${title}`, color: ACCENT, bold: true }));
    if (intro) for (const l of wrap(intro, width - 2)) push(line({ t: ` ${l}`, dim: true }));
  };
  const add = (row: Row) => selectable.push(row);
  const current = selKey ?? 'cuenta:principal';
  const isSel = (r: Row) => rowKey(r) === current;
  const cursor = (r: Row) => ({ t: isSel(r) ? ' ▸ ' : '   ', color: ACCENT });

  if (welcome) {
    for (const l of wrap(t('setupWelcome'), width - 2)) push(line({ t: ` ${l}`, color: OK }));
    push([]);
  }

  // Cuentas
  section(t('setupAccounts'), t('setupAccountsIntro'));
  const emailOf = (a: Account) => {
    const s = status[a.nombre];
    return s ? (s.loggedIn ? s.email : null) : a.email;
  };
  const nameW = Math.max(10, ...accounts.map(a => a.nombre.length)) + 2;
  for (const a of accounts) {
    const row: Row = { kind: 'cuenta', nombre: a.nombre };
    add(row);
    const s = status[a.nombre];
    const email = emailOf(a);
    const twin = email ? accounts.find(b => b !== a && emailOf(b) === email) : undefined;
    const logged = s ? s.loggedIn : a.conSesion;
    const segs: Line = [
      cursor(row),
      { t: logged ? '● ' : '○ ', color: logged ? OK : MUTED },
      { t: fit(a.nombre, nameW), bold: isSel(row) },
    ];
    if (!logged) segs.push({ t: t('setupNoSession'), color: WARN });
    else segs.push({ t: `${email ?? ''}${s?.plan ? ` · ${s.plan}` : ''}` });
    if (s === undefined) segs.push({ t: `  ${t('setupChecking')}`, color: MUTED });
    segs.push({ t: `  ${tildePath(a.dir)}`, color: MUTED });
    if (twin && logged) segs.push({ t: `  ${t('setupSame', { name: twin.nombre })}`, color: WARN });
    push(segs, row);
  }
  const newAccount: Row = { kind: 'nuevaCuenta' };
  add(newAccount);
  push(line(cursor(newAccount), { t: t('setupAddAccount'), color: isSel(newAccount) ? ACCENT : MUTED }), newAccount);
  if (input?.kind === 'cuenta') push(line({ t: `     ${t('setupAccountName')} ` }, { t: `${input.text}▏`, color: ACCENT }));
  push([]);

  // Preferencias
  section(t('setupPrefs'));
  const labelW = Math.max(...(Object.keys(PREF_LABEL) as PrefKey[]).map(k => t(PREF_LABEL[k]).length)) + 2;
  for (const key of Object.keys(PREF_LABEL) as PrefKey[]) {
    const row: Row = { kind: 'pref', key };
    add(row);
    const options = prefOptions(key, accounts);
    const value = prefValue(cfg, key);
    const label = (options.find(o => o.value === value) ?? options[0]).label();
    push(line(cursor(row), { t: fit(t(PREF_LABEL[key]), labelW) }, { t: `‹ ${label} ›`, color: isSel(row) ? ACCENT : undefined, bold: isSel(row) }), row);
  }
  push([]);

  // Carpetas raíz
  section(t('setupRoots'));
  (cfg.raices ?? []).forEach((r, index) => {
    const row: Row = { kind: 'raiz', index };
    add(row);
    push(line(cursor(row), { t: tildePath(r), color: FOLDER }), row);
  });
  const newRoot: Row = { kind: 'nuevaRaiz' };
  add(newRoot);
  push(line(cursor(newRoot), { t: t('setupAddRoot'), color: isSel(newRoot) ? ACCENT : MUTED }), newRoot);
  if (input?.kind === 'raiz') push(line({ t: `     ${t('setupRootPrompt')} ` }, { t: `${input.text}▏`, color: ACCENT }));
  push([]);

  // Reglas
  section(t('setupRules'));
  (cfg.reglas ?? []).forEach((r, index) => {
    const row: Row = { kind: 'regla', index };
    add(row);
    push(line(cursor(row), { t: tildePath(r.carpeta), color: FOLDER }, { t: '  →  ' }, { t: `‹ ${r.cuenta} ›`, color: isSel(row) ? ACCENT : undefined, bold: isSel(row) }), row);
  });
  const newRule: Row = { kind: 'nuevaRegla' };
  add(newRule);
  push(line(cursor(newRule), { t: t('setupAddRule'), color: isSel(newRule) ? ACCENT : MUTED }), newRule);
  if (input?.kind === 'regla') push(line({ t: `     ${t('setupRulePrompt')} ` }, { t: `${input.text}▏`, color: ACCENT }));

  // ── Acciones ──────────────────────────────────────────────────────────
  const selIndex = Math.max(0, selectable.findIndex(r => rowKey(r) === current));
  const selected = selectable[selIndex];

  const cycle = (row: Row, dir: 1 | -1) => {
    if (row.kind === 'pref') {
      const options = prefOptions(row.key, accounts);
      const i = options.findIndex(o => o.value === prefValue(cfg, row.key));
      const next = options[(i + dir + options.length) % options.length].value;
      if (row.key === 'idioma') setLang((next as Lang | undefined) ?? detectLang());
      update({ ...cfg, [row.key]: next });
    } else if (row.kind === 'regla') {
      const reglas = [...(cfg.reglas ?? [])];
      const i = accounts.findIndex(a => a.nombre === reglas[row.index].cuenta);
      reglas[row.index] = { ...reglas[row.index], cuenta: accounts[(i + dir + accounts.length) % accounts.length].nombre };
      update({ ...cfg, reglas });
    }
  };

  const activate = (row: Row) => {
    setMsg(null);
    switch (row.kind) {
      case 'cuenta':
        onAction({ kind: 'login', cuenta: row.nombre });
        exit();
        return;
      case 'nuevaCuenta':
        setInput({ kind: 'cuenta', text: '' });
        return;
      case 'nuevaRaiz':
        setInput({ kind: 'raiz', text: '' });
        return;
      case 'nuevaRegla':
        setInput({ kind: 'regla', text: '' });
        return;
      default:
        cycle(row, 1);
    }
  };

  const remove = (row: Row) => {
    if (row.kind === 'raiz') update({ ...cfg, raices: (cfg.raices ?? []).filter((_, i) => i !== row.index) });
    else if (row.kind === 'regla') update({ ...cfg, reglas: (cfg.reglas ?? []).filter((_, i) => i !== row.index) });
  };

  const submit = (inp: NonNullable<Input>) => {
    const text = inp.text.trim();
    if (!text) {
      setInput(null);
      return;
    }
    if (inp.kind === 'cuenta') {
      try {
        createAccount(text);
        setAccounts(getAccounts(true));
        setInput(null);
        onAction({ kind: 'login', cuenta: text });
        exit();
      } catch (err) {
        setMsg({ texto: (err as Error).message, color: ERROR });
      }
      return;
    }
    const path = expandHome(text);
    if (!existsSync(path)) {
      setMsg({ texto: t('setupNoFolder', { path: text }), color: ERROR });
      return;
    }
    setInput(null);
    if (inp.kind === 'raiz') {
      const raices = cfg.raices ?? [];
      if (!raices.some(r => normalizePath(r) === normalizePath(path))) update({ ...cfg, raices: [...raices, path] });
    } else {
      const cuenta = (accounts.find(a => a.conSesion) ?? accounts[0]).nombre;
      const reglas = [...(cfg.reglas ?? []), { carpeta: path, cuenta }];
      update({ ...cfg, reglas });
      setSelKey(rowKey({ kind: 'regla', index: reglas.length - 1 }));
    }
  };

  useInput((ch, key) => {
    if (input) {
      if (key.escape) setInput(null);
      else if (key.return) submit(input);
      else if (key.backspace || key.delete) setInput({ ...input, text: input.text.slice(0, -1) });
      else if (ch && !key.ctrl && !key.meta && !key.tab) setInput({ ...input, text: input.text + ch });
      return;
    }
    if (key.escape || (key.ctrl && ch === 'c')) {
      // Pasar por aquí cuenta como configurado, aunque no se haya cambiado nada
      if (!cfg.configurado) update(cfg);
      exit();
      return;
    }
    if (key.upArrow) setSelKey(rowKey(selectable[Math.max(0, selIndex - 1)]));
    else if (key.downArrow || key.tab) setSelKey(rowKey(selectable[Math.min(selectable.length - 1, selIndex + 1)]));
    else if (key.leftArrow) cycle(selected, -1);
    else if (key.rightArrow) cycle(selected, 1);
    else if (key.return) activate(selected);
    else if (ch === 'd') remove(selected);
    else if (ch === 's' && selected.kind === 'cuenta') {
      if (confirmLogout === selected.nombre) {
        setConfirmLogout(null);
        onAction({ kind: 'logout', cuenta: selected.nombre });
        exit();
      } else {
        setConfirmLogout(selected.nombre);
        setMsg({ texto: t('setupLogoutConfirm', { name: selected.nombre }), color: WARN });
      }
    }
  });

  // ── Pantalla: título, cuerpo desplazable, mensaje y teclas ────────────
  const height = Math.max(8, rows - 1);
  const bodyH = height - BODY_Y + 1 - 3;
  const selLine = lineRow.findIndex(r => r && rowKey(r) === current);
  const top = Math.max(0, Math.min(lines.length - bodyH, selLine - bodyH + 3));
  const body = lines.slice(top, top + bodyH);
  while (body.length < bodyH) body.push([]);

  useEffect(() => {
    if (!mouse) return;
    const onMouse = (ev: MouseEvent) => {
      if (ev.tipo === 'rueda-abajo' || ev.tipo === 'rueda-arriba') {
        const i = selIndex + (ev.tipo === 'rueda-abajo' ? 1 : -1);
        setSelKey(rowKey(selectable[Math.max(0, Math.min(selectable.length - 1, i))]));
        return;
      }
      const row = lineRow[top + ev.y - BODY_Y];
      if (!row || input) return;
      if (rowKey(row) === current) activate(row);
      else setSelKey(rowKey(row));
    };
    mouse.on('mouse', onMouse);
    return () => {
      mouse.off('mouse', onMouse);
    };
  });

  const screen: Line[] = [
    line({ t: ' ✻ cses', color: ACCENT, bold: true }, { t: ` · ${t('setupTitle')}` }),
    [],
    ...body,
    msg ? line({ t: ` ${fit(msg.texto, width - 1)}`, color: msg.color }) : [],
    [],
    line({ t: ` ${fit(input ? t('setupInputKeys') : t('setupKeys'), width - 1)}`, dim: true }),
  ];

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Lines lines={screen} />
    </Box>
  );
};

export default Setup;
