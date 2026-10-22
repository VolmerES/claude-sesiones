import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { StringDecoder } from 'string_decoder';

export interface MouseEvent {
  tipo: 'clic' | 'rueda-arriba' | 'rueda-abajo';
  // Columna y fila, empezando en 1
  x: number;
  y: number;
}

// Secuencias SGR del ratón (modo 1006): ESC [ < botón ; x ; y M|m
// eslint-disable-next-line no-control-regex -- el ESC es justo lo que se busca
const SGR_MOUSE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
// Trozo de secuencia de ratón cortado al final de un bloque de entrada
// eslint-disable-next-line no-control-regex -- ídem
const PARTIAL = /\x1b\[<[\d;]*$/;

const MOUSE_ON = '\x1b[?1000h\x1b[?1006h';
const MOUSE_OFF = '\x1b[?1000l\x1b[?1006l';

/**
 * Entrada para Ink que separa el ratón del teclado: Ink no entiende las secuencias del
 * ratón y las tomaría por teclas. El resto de la entrada pasa tal cual.
 */
export class FilteredInput extends PassThrough {
  readonly isTTY = true;
  readonly mouse = new EventEmitter();
  private carry = '';
  private readonly decoder = new StringDecoder('utf8');
  private readonly source: NodeJS.ReadStream;
  private readonly onData = (buf: Buffer) => this.feed(this.decoder.write(buf));

  constructor(source: NodeJS.ReadStream = process.stdin) {
    super();
    this.source = source;
    source.on('data', this.onData);
  }

  feed(text: string) {
    let s = this.carry + text;
    this.carry = '';
    const partial = PARTIAL.exec(s);
    if (partial) {
      this.carry = partial[0];
      s = s.slice(0, partial.index);
    }
    const rest = s.replace(SGR_MOUSE, (_m, b: string, x: string, y: string, kind: string) => {
      const button = Number(b);
      if (kind === 'M') {
        const ev = { x: Number(x), y: Number(y) };
        if (button === 0) this.mouse.emit('mouse', { tipo: 'clic', ...ev } satisfies MouseEvent);
        else if (button === 64) this.mouse.emit('mouse', { tipo: 'rueda-arriba', ...ev } satisfies MouseEvent);
        else if (button === 65) this.mouse.emit('mouse', { tipo: 'rueda-abajo', ...ev } satisfies MouseEvent);
      }
      return '';
    });
    if (rest) this.write(rest);
  }

  setRawMode(mode: boolean) {
    this.source.setRawMode?.(mode);
    return this;
  }

  ref() {
    this.source.ref();
    return this;
  }

  unref() {
    this.source.unref();
    return this;
  }

  enableMouse() {
    process.stdout.write(MOUSE_ON);
  }

  disableMouse() {
    process.stdout.write(MOUSE_OFF);
  }

  dispose() {
    this.disableMouse();
    this.source.off('data', this.onData);
    this.source.pause();
  }
}
