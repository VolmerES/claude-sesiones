import { t } from '../i18n.js';

const DAY = 86_400_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const dayName = (d: Date) => t('days').split(',')[d.getDay()];
const monthName = (d: Date) => t('months').split(',')[d.getMonth()];
const daysAgo = (ms: number, now: number) => Math.round((startOfDay(now) - startOfDay(ms)) / DAY);

// Fecha corta para la lista: «12:06», «ayer», «lun», «16 oct», «oct 2025»
export function shortDate(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const days = daysAgo(ms, now);
  if (days <= 0) return hhmm(d);
  if (days === 1) return t('yesterday');
  if (days < 7) return dayName(d);
  if (d.getFullYear() === new Date(now).getFullYear()) return `${d.getDate()} ${monthName(d)}`;
  return `${monthName(d)} ${d.getFullYear()}`;
}

// Una hora que aún no ha llegado: «13:30» si es hoy y «jue 13:30» si no
export function futureTime(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  return d.toDateString() === new Date(now).toDateString() ? hhmm(d) : `${dayName(d)} ${hhmm(d)}`;
}

export function longDate(value: number | string | null, now = Date.now()): string {
  if (value === null) return '—';
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(ms)) return '—';
  const d = new Date(ms);
  const days = daysAgo(ms, now);
  if (days <= 0) return `${t('today')} ${hhmm(d)}`;
  if (days === 1) return `${t('yesterday')} ${hhmm(d)}`;
  const year = d.getFullYear() === new Date(now).getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${monthName(d)}${year} ${hhmm(d)}`;
}

// Grupos de la lista, como en la barra lateral de claude.ai
export function dateGroup(ms: number, now = Date.now()): string {
  const days = daysAgo(ms, now);
  if (days <= 0) return t('groupToday');
  if (days === 1) return t('groupYesterday');
  if (days < 7) return t('group7');
  if (days < 30) return t('group30');
  const d = new Date(ms);
  const month = d.toLocaleString(t('locale'), { month: 'long' });
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`;
}

// Para buscar sin que importen mayúsculas ni tildes
export function searchKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matchesQuery(haystack: string, query: string): boolean {
  const terms = searchKey(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const key = searchKey(haystack);
  return terms.every(term => key.includes(term));
}
