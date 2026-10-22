// Colores: el naranja de Claude como acento y el resto, colores básicos de la terminal
export const ACCENT = '#D97757';
export const FOLDER = 'cyan';
export const OK = 'green';
export const WARN = 'yellow';
export const ERROR = 'red';
export const MUTED = 'gray';

export interface Seg {
  t: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
}

export type Line = Seg[];

export const line = (...segs: Array<Seg | string>): Line => segs.map(s => (typeof s === 'string' ? { t: s } : s));
