import { dhashFromRgba, HashResult } from './logic/hash';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)] : 0;
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

/** Uśrednia obraz RGBA w×h do 9×9 (system może oddać miniaturę np. 18×18 lub 27×27). */
export function to9x9(rgba: Uint8Array, w: number, h: number): Uint8Array {
  if (w === 9 && h === 9) return rgba;
  const out = new Uint8Array(9 * 9 * 4);
  for (let ty = 0; ty < 9; ty++) {
    const y0 = Math.floor((ty * h) / 9);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * h) / 9));
    for (let tx = 0; tx < 9; tx++) {
      const x0 = Math.floor((tx * w) / 9);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * w) / 9));
      const sum = [0, 0, 0, 0];
      let count = 0;
      for (let y = y0; y < y1 && y < h; y++) {
        for (let x = x0; x < x1 && x < w; x++) {
          const p = (y * w + x) * 4;
          sum[0] += rgba[p];
          sum[1] += rgba[p + 1];
          sum[2] += rgba[p + 2];
          sum[3] += rgba[p + 3];
          count++;
        }
      }
      const q = (ty * 9 + tx) * 4;
      for (let k = 0; k < 4; k++) out[q + k] = count ? Math.round(sum[k] / count) : 0;
    }
  }
  return out;
}

export function hashPixels(rgba: Uint8Array, w: number, h: number): HashResult {
  return dhashFromRgba(to9x9(rgba, w, h));
}
