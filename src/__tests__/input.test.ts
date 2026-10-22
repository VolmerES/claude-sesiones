import { EventEmitter } from 'events';
import type { MouseEvent } from '../ui/input.js';
import { FilteredInput } from '../ui/input.js';

// Entrada de mentira: lo justo de un ReadStream de terminal
function fakeStdin() {
  const e = new EventEmitter() as EventEmitter & Record<string, unknown>;
  Object.assign(e, { setRawMode: () => e, ref: () => e, unref: () => e, pause: () => e });
  return e as unknown as NodeJS.ReadStream;
}

function setup() {
  const source = fakeStdin();
  const input = new FilteredInput(source);
  const events: MouseEvent[] = [];
  input.mouse.on('mouse', ev => events.push(ev));
  let text = '';
  input.setEncoding('utf8');
  input.on('data', chunk => {
    text += chunk;
  });
  const sendRaw = (b: Buffer) => source.emit('data', b);
  const send = (s: string) => sendRaw(Buffer.from(s));
  return { input, events, send, sendRaw, text: () => text };
}

const flush = () => new Promise(r => setImmediate(r));

describe('FilteredInput', () => {
  it('saca el ratón y deja pasar el teclado', async () => {
    const { events, send, text } = setup();
    send('ab\x1b[<0;12;7Mc\x1b[<0;12;7m\x1b[<64;3;4M\x1b[<65;3;4M\x1b[A');
    await flush();
    expect(text()).toBe('abc\x1b[A');
    expect(events).toEqual([
      { tipo: 'clic', x: 12, y: 7 },
      { tipo: 'rueda-arriba', x: 3, y: 4 },
      { tipo: 'rueda-abajo', x: 3, y: 4 },
    ]);
  });

  it('junta una secuencia de ratón partida en dos bloques', async () => {
    const { events, send, text } = setup();
    send('x\x1b[<0;5');
    send(';9My');
    await flush();
    expect(text()).toBe('xy');
    expect(events).toEqual([{ tipo: 'clic', x: 5, y: 9 }]);
  });

  it('un esc suelto sigue siendo la tecla esc', async () => {
    const { send, text } = setup();
    send('\x1b');
    await flush();
    expect(text()).toBe('\x1b');
  });

  it('no parte las letras de varios bytes', async () => {
    const { sendRaw, text } = setup();
    const bytes = Buffer.from('ñá');
    sendRaw(bytes.subarray(0, 1));
    sendRaw(bytes.subarray(1));
    await flush();
    expect(text()).toBe('ñá');
  });
});
