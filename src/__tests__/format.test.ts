import { dateGroup, matchesQuery, shortDate } from '../core/format.js';
import { fit, fitLeft, wrap } from '../ui/text.js';
import { getStringWidth } from '../utils/charWidth.js';
import { setLang } from '../i18n.js';

beforeAll(() => setLang('es'));

const NOW = new Date(2026, 9, 22, 12, 30).getTime(); // jueves 22-oct-2026
const at = (d: number, h = 9, m = 5, month = 9, y = 2026) => new Date(y, month, d, h, m).getTime();

describe('fechas', () => {
  it('formato corto según lo lejos que quede', () => {
    expect(shortDate(at(22, 9, 5), NOW)).toBe('09:05');
    expect(shortDate(at(21), NOW)).toBe('ayer');
    expect(shortDate(at(19), NOW)).toBe('lun');
    expect(shortDate(at(2), NOW)).toBe('2 oct');
    expect(shortDate(at(2, 9, 5, 9, 2025), NOW)).toBe('oct 2025');
  });

  it('grupos como en la barra lateral de claude.ai', () => {
    expect(dateGroup(at(22), NOW)).toBe('Hoy');
    expect(dateGroup(at(21), NOW)).toBe('Ayer');
    expect(dateGroup(at(17), NOW)).toBe('Últimos 7 días');
    expect(dateGroup(at(1), NOW)).toBe('Últimos 30 días');
    expect(dateGroup(at(10, 9, 5, 7), NOW)).toBe('Agosto 2026');
  });
});

describe('búsqueda', () => {
  it('sin importar tildes ni mayúsculas, y con todas las palabras', () => {
    expect(matchesQuery('Calibración de sensor en máquina', 'calibracion MAQUINA')).toBe(true);
    expect(matchesQuery('Calibración de sensor', 'calibracion prensa')).toBe(false);
    expect(matchesQuery('lo que sea', '   ')).toBe(true);
  });
});

describe('texto en columnas', () => {
  it('fit recorta con «…» y rellena hasta el ancho exacto', () => {
    expect(fit('hola', 6)).toBe('hola  ');
    expect(fit('hola mundo', 6)).toBe('hola …');
    expect(fit('12:30', 6, 'right')).toBe(' 12:30');
    expect(getStringWidth(fit('日本語のタイトル', 7))).toBe(7);
  });

  it('fitLeft conserva el final de las rutas', () => {
    expect(fitLeft('Developer-2/Wordpress-MCPs/Introspectia', 16)).toBe('…Ps/Introspectia');
    expect(fitLeft('corta', 8)).toBe('corta   ');
  });

  it('wrap respeta palabras y corta las que no caben', () => {
    expect(wrap('uno dos tres cuatro', 8)).toEqual(['uno dos', 'tres', 'cuatro']);
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrap('a\n\nb', 10)).toEqual(['a', '', 'b']);
  });
});
