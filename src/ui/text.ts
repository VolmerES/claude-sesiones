import { getCharWidth, getStringWidth } from '../utils/charWidth.js';

function chars(s: string): string[] {
  return Array.from(s);
}

// Recorta a un ancho de pantalla (con «…») y rellena con espacios hasta él
export function fit(s: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (width <= 0) return '';
  let out = '';
  let w = 0;
  const all = chars(s);
  const total = getStringWidth(s);
  if (total > width) {
    for (const ch of all) {
      const cw = getCharWidth(ch);
      if (w + cw > width - 1) break;
      out += ch;
      w += cw;
    }
    out += '…';
    w += 1;
  } else {
    out = s;
    w = total;
  }
  const pad = ' '.repeat(Math.max(0, width - w));
  return align === 'left' ? out + pad : pad + out;
}

// Recorta por la izquierda, para rutas: «…/Wordpress-MCPs/Introspectia»
export function fitLeft(s: string, width: number): string {
  if (getStringWidth(s) <= width) return fit(s, width);
  const all = chars(s);
  let out = '';
  let w = 1;
  for (let i = all.length - 1; i >= 0; i--) {
    const cw = getCharWidth(all[i]);
    if (w + cw > width) break;
    out = all[i] + out;
    w += cw;
  }
  return fit('…' + out, width);
}

// Parte un texto en líneas de como mucho «width» columnas, respetando palabras
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\t/g, '  ').split(/\r?\n/)) {
    if (raw.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    let lineW = 0;
    for (const word of raw.split(/(\s+)/)) {
      if (!word) continue;
      const ww = getStringWidth(word);
      if (lineW + ww <= width) {
        line += word;
        lineW += ww;
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      line = '';
      lineW = 0;
      if (/^\s+$/.test(word)) continue;
      // Palabra más larga que la línea: se corta a trozos
      let rest = word;
      while (getStringWidth(rest) > width) {
        let piece = '';
        let pw = 0;
        for (const ch of chars(rest)) {
          const cw = getCharWidth(ch);
          if (pw + cw > width) break;
          piece += ch;
          pw += cw;
        }
        lines.push(piece);
        rest = rest.slice(piece.length);
      }
      line = rest;
      lineW = getStringWidth(rest);
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
