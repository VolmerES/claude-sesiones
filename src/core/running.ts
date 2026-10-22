import { readdirSync, readFileSync, realpathSync } from 'fs';
import { join } from 'path';
import type { Account } from './accounts.js';
import { normalizePath } from './paths.js';

export interface RunningSession {
  sessionId: string;
  pid: number;
  cuenta: string;
  estado: string | null;
}

interface SessionPidFile {
  pid?: number;
  sessionId?: string;
  status?: string;
}

export function alive(pid: number): boolean {
  try {
    // Con la señal 0 solo se pregunta si existe (también en Windows): no mata nada
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// Claude Code deja un <pid>.json en sessions/ por cada sesión abierta
export function runningSessions(accounts: Account[]): Map<string, RunningSession> {
  const result = new Map<string, RunningSession>();
  const seen = new Set<string>();
  for (const account of accounts) {
    const dir = join(account.dir, 'sessions');
    let real: string;
    try {
      real = normalizePath(realpathSync(dir));
    } catch {
      continue;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!/^\d+\.json$/.test(f)) continue;
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as SessionPidFile;
        if (!data.sessionId || !data.pid || !alive(data.pid)) continue;
        result.set(data.sessionId, { sessionId: data.sessionId, pid: data.pid, cuenta: account.nombre, estado: data.status ?? null });
      } catch {
        // A medio escribir: se mirará en el siguiente refresco
      }
    }
  }
  return result;
}

// Lo que Claude Code dice de un proceso suyo concreto: qué conversación tiene y si está
// respondiendo. Con /resume o /clear la conversación cambia sin cambiar de proceso
export function sessionOfPid(account: Account, pid: number): { sessionId: string | null; estado: string | null } | null {
  try {
    const data = JSON.parse(readFileSync(join(account.dir, 'sessions', `${pid}.json`), 'utf-8')) as SessionPidFile;
    return { sessionId: data.sessionId ?? null, estado: data.status ?? null };
  } catch {
    return null;
  }
}
