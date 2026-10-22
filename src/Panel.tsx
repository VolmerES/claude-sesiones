import React, { useEffect, useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import type { EventEmitter } from 'events';
import type { Account } from './core/accounts.js';
import { getAccounts } from './core/accounts.js';
import { createAccount } from './core/accountAdmin.js';
import { futureTime } from './core/format.js';
import { runInNewTab } from './core/launcher.js';
import { focusClaude } from './core/supervisor.js';
import type { LimitHit, PanelState } from './core/panelLink.js';
import { accountAt, findTranscript, limitFromTail, loadLimits, readState, readTail, saveLimit, writeOrder } from './core/panelLink.js';
import { HOME } from './core/paths.js';
import { alive, sessionOfPid } from './core/running.js';
import { t } from './i18n.js';
import { Lines } from './ui/Lines.js';
import type { MouseEvent } from './ui/input.js';
import { fit, wrap } from './ui/text.js';
import type { Line } from './ui/theme.js';
import { ACCENT, ERROR, MUTED, OK, WARN, line } from './ui/theme.js';
import { useTerminalSize } from './ui/useTerminalSize.js';

interface PanelProps {
  id: string;
  mouse: EventEmitter | null;
}

interface Snapshot {
  state: PanelState | null;
  accounts: Account[];
  limits: Record<string, LimitHit>;
  // Lo que dice claude de sí mismo: «busy» mientras responde
  estado: string | null;
}

type Action = { kind: 'cuenta'; nombre: string } | { kind: 'nueva' };
type Msg = { texto: string; color?: string } | null;

// Si el supervisor no aparece en este tiempo, el panel se cierra solo
const WAIT_MS = 15_000;
// Dos clics en una cuenta mientras claude responde: el segundo confirma
const CONFIRM_MS = 6_000;
const NAME_CHAR = /^[a-z0-9_-]$/i;

function snapshot(id: string): Snapshot {
  const state = readState(id);
  const accounts = getAccounts(true);
  let estado: string | null = null;
  const current = state ? accounts.find(a => a.nombre === state.cuenta) : undefined;
  if (state && current) {
    const info = state.claudePid ? sessionOfPid(current, state.claudePid) : null;
    estado = info?.estado ?? null;
    const sessionId = info?.sessionId ?? state.sessionId;
    const file = sessionId && current.projectsReal ? findTranscript(current.projectsReal, sessionId) : null;
    const hit = file ? limitFromTail(readTail(file)) : null;
    // El aviso es de la cuenta que había cuando se escribió, que puede no ser la de ahora
    if (hit) saveLimit(accountAt(state.historial, hit.ts) ?? state.cuenta, hit);
  }
  return { state, accounts, limits: loadLimits(), estado };
}

const Panel: React.FC<PanelProps> = ({ id, mouse }) => {
  const { exit } = useApp();
  const { cols, rows } = useTerminalSize();
  const [snap, setSnap] = useState<Snapshot>(() => snapshot(id));
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState<Msg>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ nombre: string; hasta: number } | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  // Se relee todo cada segundo; el panel se cierra cuando se cierra claude
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const next = snapshot(id);
      if (next.state ? !alive(next.state.supervisor) : Date.now() - started > WAIT_MS) {
        exit();
        return;
      }
      setSnap(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [id, exit]);

  const { state, accounts, limits, estado } = snap;
  const current = state ? accounts.find(a => a.nombre === state.cuenta) ?? null : null;
  const width = Math.max(10, cols - 1);
  const inner = width - 3;

  const openLogin = (account: Account) => {
    const r = runInNewTab({ cwd: HOME, account, extraArgs: [], titulo: `login ${account.nombre}` });
    setMsg(r.ok ? { texto: t('panelLoginTab'), color: OK } : { texto: t('panelLoginFailed', { name: account.nombre }), color: ERROR });
  };

  const choose = (nombre: string) => {
    const account = accounts.find(a => a.nombre === nombre);
    if (!account || !state || nombre === state.cuenta) return;
    if (!account.conSesion) {
      openLogin(account);
      return;
    }
    if (current && account.projectsReal !== current.projectsReal) {
      setMsg({ texto: t('panelNotShared', { name: nombre }), color: WARN });
      return;
    }
    if (estado === 'busy' && !(confirm && confirm.nombre === nombre && Date.now() < confirm.hasta)) {
      setConfirm({ nombre, hasta: Date.now() + CONFIRM_MS });
      setMsg({ texto: t('panelConfirmBusy'), color: WARN });
      return;
    }
    setConfirm(null);
    writeOrder(id, { cuenta: nombre });
    setSwitching(nombre);
    setMsg(null);
    focusClaude();
  };

  const addAccount = (nombre: string) => {
    try {
      createAccount(nombre);
      const created = getAccounts(true).find(a => a.nombre === nombre);
      setNaming(null);
      if (created) openLogin(created);
      setSnap(s => ({ ...s, accounts: getAccounts() }));
    } catch (err) {
      setMsg({ texto: (err as Error).message, color: ERROR });
    }
  };

  const run = (action: Action | undefined) => {
    if (!action) return;
    if (action.kind === 'nueva') {
      setNaming('');
      setMsg(null);
    } else {
      choose(action.nombre);
    }
  };

  // ── Lo que se pinta, línea a línea, con la acción de cada una para el ratón ──
  const lines: Line[] = [];
  const actions: Array<Action | undefined> = [];
  const push = (l: Line, action?: Action) => {
    lines.push(l);
    actions.push(action);
  };
  const selectable: Action[] = [...accounts.map(a => ({ kind: 'cuenta' as const, nombre: a.nombre })), { kind: 'nueva' }];
  const selected = selectable[Math.min(sel, selectable.length - 1)];

  push(line({ t: ` ${t('panelTitle')}`, color: ACCENT, bold: true }));
  push(line({ t: ` ${'─'.repeat(Math.max(1, width - 2))}`, dim: true }));

  if (!state) {
    push(line({ t: ` ${t('panelWaiting')}`, dim: true }));
  } else {
    const currentLimit = limits[state.cuenta];
    if (currentLimit) {
      push(line({ t: ` ${t('panelLimitBanner')}`, color: WARN, bold: true }));
      for (const l of wrap(t('panelLimitHint'), inner + 1)) push(line({ t: ` ${l}`, dim: true }));
      push([]);
    }
    for (const a of accounts) {
      const action: Action = { kind: 'cuenta', nombre: a.nombre };
      const isCurrent = a.nombre === state.cuenta;
      const isSel = selected?.kind === 'cuenta' && selected.nombre === a.nombre;
      const mark = isCurrent ? '●' : a.conSesion ? '○' : '·';
      push(line(
        { t: isSel ? '▸' : ' ', color: ACCENT },
        { t: `${mark} `, color: isCurrent ? ACCENT : MUTED },
        { t: fit(a.nombre, inner - 1), bold: isCurrent, color: isCurrent ? ACCENT : undefined },
      ), action);
      push(line({ t: `   ${fit(a.email ?? '', inner).trimEnd()}`, dim: true }), action);
      const hit = limits[a.nombre];
      let status: Line = [];
      if (hit) {
        const back = hit.hasta ? ` · ${t('panelResets', { time: futureTime(hit.hasta) })}` : '';
        status = line({ t: `   ${fit(`${t('panelLimit')}${back}`, inner).trimEnd()}`, color: WARN });
      } else if (isCurrent) {
        status = line({ t: `   ${estado === 'busy' ? t('panelBusy') : t('panelInUse')}`, color: OK });
      } else if (!a.conSesion) {
        status = line({ t: `   ${fit(t('panelNoSession'), inner).trimEnd()}`, dim: true });
      } else if (current && a.projectsReal !== current.projectsReal) {
        status = line({ t: `   ${fit(t('panelOwnHistory'), inner).trimEnd()}`, dim: true });
      }
      push(status, action);
      push([]);
    }
    const addSel = selected?.kind === 'nueva';
    push(line({ t: addSel ? '▸' : ' ', color: ACCENT }, { t: t('panelAdd'), color: addSel ? ACCENT : MUTED }), { kind: 'nueva' });
    if (naming !== null) {
      push(line({ t: ` ${fit(t('panelAddPrompt'), inner + 1)}` }));
      push(line({ t: ' ❯ ', color: ACCENT }, { t: fit(`${naming}▏`, inner - 1) }));
      push(line({ t: ` ${fit(t('panelAddHint'), inner + 1)}`, dim: true }));
    }
  }

  // «Cambiando a…» hasta que el supervisor dice que ya está con la otra cuenta
  const shownMsg: Msg = switching && state && state.cuenta !== switching
    ? { texto: t('panelSwitching', { name: switching }), color: ACCENT }
    : msg;
  if (shownMsg) {
    push([]);
    for (const l of wrap(shownMsg.texto, inner + 1)) push(line({ t: ` ${l}`, color: shownMsg.color }));
  }

  // Las teclas, abajo del todo
  const height = Math.max(4, rows - 1);
  const shown = lines.slice(0, height - 1);
  while (shown.length < height - 1) shown.push([]);
  shown.push(line({ t: ` ${fit(t('panelKeys'), inner + 1)}`, dim: true }));

  useInput((input, key) => {
    if (naming !== null) {
      if (key.escape) setNaming(null);
      else if (key.return) addAccount(naming);
      else if (key.backspace || key.delete) setNaming(naming.slice(0, -1));
      else if (NAME_CHAR.test(input)) setNaming(naming + input);
      return;
    }
    if (key.upArrow) setSel(s => Math.max(0, s - 1));
    else if (key.downArrow) setSel(s => Math.min(selectable.length - 1, s + 1));
    else if (key.return) run(selected);
    else if (input === 'n' || input === '+') run({ kind: 'nueva' });
  });

  useEffect(() => {
    if (!mouse) return;
    const onMouse = (ev: MouseEvent) => {
      if (ev.tipo !== 'clic') return;
      const action = actions[ev.y - 1];
      if (!action) return;
      setSel(Math.max(0, selectable.findIndex(s => s.kind === action.kind && (s.kind === 'nueva' || (action.kind === 'cuenta' && s.nombre === action.nombre)))));
      run(action);
    };
    mouse.on('mouse', onMouse);
    return () => {
      mouse.off('mouse', onMouse);
    };
  });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Lines lines={shown} />
    </Box>
  );
};

export default Panel;
