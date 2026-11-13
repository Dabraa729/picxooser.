// Hash percepcyjny: dwa dHashe 8x8 (gradienty poziome i pionowe) z obrazu 9x9.
// 128 bitów trzymamy jako cztery liczby 32-bitowe, żeby nie polegać na BigInt.

export type Hash = [number, number, number, number];
export type RGB = [number, number, number];

export interface HashResult {
  hash: Hash;
  mean: RGB; // średni kolor — odróżnia np. zdjęcie całe czarne od całego białego
  spread: number; // rozpiętość jasności 0–255; mała = obraz jednolity
}

/** rgba: 9*9*4 bajtów (wiersz po wierszu). */
export function dhashFromRgba(rgba: ArrayLike<number>): HashResult {
  if (rgba.length < 9 * 9 * 4) throw new Error('dhash: oczekiwano obrazu 9x9 RGBA');
  const gray: number[] = new Array(81);
  const sums = [0, 0, 0];
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 81; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    sums[0] += r;
    sums[1] += g;
    sums[2] += b;
    const y = 299 * r + 587 * g + 114 * b;
    gray[i] = y;
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  const hash: Hash = [0, 0, 0, 0];
  let bit = 0;
  const push = (on: boolean) => {
    if (on) hash[bit >>> 5] = (hash[bit >>> 5] | (1 << (31 - (bit & 31)))) >>> 0;
    bit++;
  };
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) push(gray[y * 9 + x] > gray[y * 9 + x + 1]);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) push(gray[y * 9 + x] > gray[(y + 1) * 9 + x]);
  return {
    hash,
    mean: [Math.floor(sums[0] / 81), Math.floor(sums[1] / 81), Math.floor(sums[2] / 81)],
    spread: Math.floor((hi - lo) / 1000),
  };
}

function popcount32(v: number): number {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Liczba różniących się bitów (0–128). */
export function distance(a: Hash, b: Hash): number {
  return (
    popcount32((a[0] ^ b[0]) >>> 0) +
    popcount32((a[1] ^ b[1]) >>> 0) +
    popcount32((a[2] ^ b[2]) >>> 0) +
    popcount32((a[3] ^ b[3]) >>> 0)
  );
}

export function meanDiff(a: RGB, b: RGB): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}
