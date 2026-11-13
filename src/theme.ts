export const C = {
  bg: '#0B0D10',
  surface: '#14171C',
  surface2: '#1C2027',
  line: '#2A2F38',
  text: '#F3F5F7',
  muted: '#A3ACB8',
  keep: '#5BB8FF', // wygrywa / zostaje
  drop: '#FF9F45', // odpada / do usunięcia
  tie: '#3A404B',
};

export const TONES = ['#18222E', '#232033', '#1D2A26', '#2B2119', '#2A1F2B', '#1F2A30', '#2A2A1C', '#221F2E'];

/** A, B, C… a po 26 plikach numery. */
export function letter(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
}

export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many;
}

export function fmtDate(ms: number): string {
  const d = new Date(ms);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function fmtDuration(sec: number): string {
  const t = Math.round(sec);
  const m = Math.floor(t / 60);
  return `${m}:${String(t % 60).padStart(2, '0')}`;
}
