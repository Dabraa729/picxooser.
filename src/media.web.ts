// Wersja demonstracyjna dla przeglądarki: sztuczna biblioteka, żeby dało się obejrzeć i przetestować interfejs.
import { dhashFromRgba } from './logic/hash';
import type { Hash, RGB } from './logic/hash';
import type { Kind, MediaItem } from './types';

export const isDemo = true;
export type Access = 'granted' | 'limited' | 'denied';

const HUES = [205, 28, 150, 280, 340, 95, 55, 240, 12, 180];
const SIZES: [number, number][] = [[4032, 3024], [3024, 2268], [2048, 1536], [1280, 960], [640, 480], [4032, 3024], [1920, 1440], [1024, 768]];
const GROUPS: Record<Kind, number[]> = { photo: [4, 2, 8, 3, 2, 2, 3], video: [3, 2, 2] }; // liczebność grup demo

function picture(seed: number, variant: number, label: string): string {
  const hue = HUES[seed % HUES.length];
  const shapes = Array.from({ length: 5 }, (_, i) => {
    const x = (seed * 37 + i * 61) % 100, y = (seed * 53 + i * 29) % 100, r = 10 + ((seed * 7 + i * 13) % 22);
    return `<circle cx="${x}%" cy="${y}%" r="${r}%" fill="hsl(${(hue + i * 40) % 360} 60% ${35 + i * 9}%)" opacity="0.85"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="hsl(${hue} 45% ${22 + variant}%)"/>${shapes}<text x="50%" y="92%" font-family="sans-serif" font-size="34" fill="white" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function build(kind: Kind): MediaItem[] {
  const items: MediaItem[] = [];
  const now = Date.UTC(2026, 10, 13);
  GROUPS[kind].forEach((count, g) => {
    for (let v = 0; v < count; v++) {
      const [w, h] = SIZES[(g + v * 3) % SIZES.length];
      items.push({
        id: `${kind}-g${g}-v${v}`, uri: picture(g + (kind === 'video' ? 40 : 0), v, `${kind === 'video' ? 'film' : 'zdjęcie'} ${g + 1}.${v + 1}`),
        kind, width: w, height: h, duration: kind === 'video' ? 42 + g * 17 : 0,
        created: now - (g * 5 + v) * 86400000, modified: now - (g * 5 + v) * 86400000, filename: `IMG_${1000 + g * 10 + v}`,
      });
    }
  });
  for (let s = 0; s < 6; s++) { // pliki bez duplikatów
    items.push({ id: `${kind}-solo${s}`, uri: picture(100 + s, 0, 'bez duplikatu'), kind, width: 3024, height: 4032, duration: kind === 'video' ? 300 + s * 100 : 0, created: now - s * 3600000, modified: now, filename: `IMG_${2000 + s}` });
  }
  return items;
}

function pattern(seed: number, noise: number): number[] {
  const out: number[] = [];
  let t = noise + 1;
  const rnd = () => ((t = (t * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5);
  const fx = 1 + (seed % 5), fy = 1 + ((seed >> 2) % 4), ph = seed * 0.7;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const v = 128 + 100 * Math.sin((x * fx) / 3 + ph) * Math.cos((y * fy) / 3 + ph / 2) + ((seed * 31 + x * 17 + y * 7) % 23);
    const c = Math.max(0, Math.min(255, Math.round(v + rnd() * (noise ? 6 : 0))));
    out.push(c, c, c, 255);
  }
  return out;
}

const seedOf = (id: string) => {
  const m = /-g(\d+)-v(\d+)$/.exec(id);
  if (m) return { seed: Number(m[1]) + 1 + (id.startsWith('video') ? 50 : 0), variant: Number(m[2]) };
  return { seed: 500 + Number(/(\d+)$/.exec(id)?.[1] ?? 0) * 3, variant: 0 };
};

export async function requestAccess(): Promise<Access> { return 'granted'; }
export async function listMedia(kind: Kind, limit: number, onProgress?: (n: number) => void): Promise<MediaItem[]> {
  const items = build(kind);
  onProgress?.(items.length);
  return limit > 0 ? items.slice(0, limit) : items;
}
export async function localUri(_item: MediaItem): Promise<string | null> { return null; }
export async function photoSignature(item: MediaItem): Promise<{ hash: Hash; mean: RGB } | null> {
  const { seed, variant } = seedOf(item.id);
  const r = dhashFromRgba(pattern(seed, variant));
  return { hash: r.hash, mean: r.mean };
}
export async function videoSignature(item: MediaItem): Promise<{ frames: (Hash | null)[]; mean: RGB } | null> {
  const { seed, variant } = seedOf(item.id);
  return { frames: [0, 1, 2, 3, 4].map((k) => dhashFromRgba(pattern(seed * 10 + k, variant)).hash), mean: [100, 100, 100] };
}
export async function frameUri(item: MediaItem, _seconds: number): Promise<string | null> { return item.uri; }
export async function deleteItems(_ids: string[]): Promise<boolean> { return true; }
