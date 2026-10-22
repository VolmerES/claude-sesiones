import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { csesDir } from './paths.js';

// Con CSES_DEBUG=1, lo que pasa por dentro va a ~/.cses/debug.log (para los issues)
export function debug(where: string, ...data: unknown[]) {
  if (!process.env.CSES_DEBUG) return;
  try {
    mkdirSync(csesDir(), { recursive: true });
    const text = data.map(d => (typeof d === 'string' ? d : JSON.stringify(d))).join(' ');
    appendFileSync(join(csesDir(), 'debug.log'), `${new Date().toISOString()} [${process.pid} ${where}] ${text}\n`);
  } catch {
    // Depurar nunca debe romper nada
  }
}
