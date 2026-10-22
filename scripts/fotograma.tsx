// Pinta la interfaz como texto con los datos reales, para probarla sin terminal:
//   KEYS=down,down,tab,right COLS=140 ROWS=34 npx tsx scripts/fotograma.tsx
// Teclas: down up left right tab enter esc slash bs, ^x para Ctrl+x, clic:x:y doble:x:y rueda:x:y,
// o cualquier carácter suelto
// Con PANEL=<cuenta> pinta el panel de cuentas como si claude estuviera abierto con esa
// cuenta (SESSION=<id> para su conversación). Mejor con CSES_DIR en una carpeta temporal
import React from 'react';
import { render } from 'ink-testing-library';
import { EventEmitter } from 'events';
import App from '../src/App.js';
import Panel from '../src/Panel.js';
import { writeState } from '../src/core/panelLink.js';
const mouse = new EventEmitter();
const cols = Number(process.env.COLS || 140), rows = Number(process.env.ROWS || 34);
if (process.env.PANEL) {
  writeState('fotograma', {
    supervisor: process.pid, claudePid: null, cuenta: process.env.PANEL, cwd: process.cwd(), sessionId: process.env.SESSION ?? null,
    titulo: 'fotograma', historial: [{ cuenta: process.env.PANEL, desde: 0 }],
  });
}
const r = render(process.env.PANEL ? <Panel id="fotograma" mouse={mouse} /> : <App extraArgs={[]} initialFolder={process.env.FOLDER ?? null} mouse={mouse} onLaunch={req => console.log(">>> onLaunch", JSON.stringify({ ...req, account: req.account.nombre }))} />);
// ink-testing-library no deja fijar el tamaño al crear: se ajusta después
Object.defineProperty(r.stdout, "columns", { get: () => cols }); Object.defineProperty(r.stdout, "rows", { get: () => rows });
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const show = (t: string) => console.log(`\n===== ${t} =====\n` + r.lastFrame());
await wait(300); r.stdout.emit('resize'); await wait(Number(process.env.WAIT || 1500));
show('inicio');
for (const k of (process.env.KEYS || '').split(',').filter(Boolean)) {
  const map: Record<string,string> = { down: '\u001b[B', up: '\u001b[A', tab: '\t', right: '\u001b[C', left: '\u001b[D', enter: '\r', esc: '\u001b', slash: '/', bs: '\u007f' };
  // «clic:x:y», «rueda:x:y» o «doble:x:y» simulan el ratón
  const m = /^(clic|doble|rueda|ruedaup):(\d+):(\d+)$/.exec(k);
  if (m) {
    const ev = { x: Number(m[2]), y: Number(m[3]) };
    if (m[1] === 'rueda') mouse.emit('mouse', { tipo: 'rueda-abajo', ...ev });
    else if (m[1] === 'ruedaup') mouse.emit('mouse', { tipo: 'rueda-arriba', ...ev });
    else {
      mouse.emit('mouse', { tipo: 'clic', ...ev });
      if (m[1] === 'doble') { await wait(20); mouse.emit('mouse', { tipo: 'clic', ...ev }); }
    }
  } else r.stdin.write(map[k] ?? (k.startsWith('^') ? String.fromCharCode(k.charCodeAt(1) - 96) : k));
  await wait(150);
  show(k);
}
r.unmount();
process.exit(0);
