import { distance, Hash, meanDiff, RGB } from './hash';

export type Sensitivity = 'same' | 'similar';

// Te same progi co w wersji desktopowej PicXooser.
export const PHOTO_LIMITS = {
  same: { bits: 8, aspect: 0.03, mean: 16 },
  similar: { bits: 20, aspect: 0.1, mean: 40 },
} as const;

export const VIDEO_LIMITS = {
  same: { bits: 12, aspect: 0.03, mean: 20, durAbs: 1.0, durRel: 0.01 },
  similar: { bits: 24, aspect: 0.1, mean: 40, durAbs: 3.0, durRel: 0.03 },
} as const;

export const FRAME_POSITIONS = [0.1, 0.3, 0.5, 0.7, 0.9];
export const FLAT_FRAME = 10; // klatka o mniejszej rozpiętości jasności nic nie mówi

export interface PhotoSig {
  id: string;
  hash: Hash;
  mean: RGB;
  ratio: number; // szerokość / wysokość
}

export interface VideoSig {
  id: string;
  duration: number; // sekundy
  frames: (Hash | null)[]; // null = brak klatki albo klatka jednolita
  mean: RGB;
  ratio: number;
}

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    const p = this.parent;
    while (p[i] !== i) {
      p[i] = p[p[i]];
      i = p[i];
    }
    return i;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

function collect(ids: string[], uf: UnionFind): string[][] {
  const clusters = new Map<number, string[]>();
  ids.forEach((id, i) => {
    const root = uf.find(i);
    const list = clusters.get(root);
    if (list) list.push(id);
    else clusters.set(root, [id]);
  });
  return [...clusters.values()].filter((g) => g.length > 1);
}

type Tick = (done: number, total: number) => Promise<void> | void;

/** Grupuje zdjęcia przedstawiające to samo ujęcie. Zwraca listy identyfikatorów (min. 2 w grupie). */
export async function groupPhotos(sigs: PhotoSig[], sensitivity: Sensitivity, tick?: Tick): Promise<string[][]> {
  const lim = PHOTO_LIMITS[sensitivity];
  const maxLog = Math.log1p(lim.aspect);
  const n = sigs.length;
  const uf = new UnionFind(n);
  const logRatio = sigs.map((s) => Math.log(s.ratio));
  for (let i = 0; i < n - 1; i++) {
    const a = sigs[i];
    for (let j = i + 1; j < n; j++) {
      const b = sigs[j];
      if (
        distance(a.hash, b.hash) <= lim.bits &&
        Math.abs(logRatio[i] - logRatio[j]) <= maxLog &&
        meanDiff(a.mean, b.mean) <= lim.mean
      ) {
        uf.union(i, j);
      }
    }
    if (tick && i % 200 === 0) await tick(i, n);
  }
  return collect(sigs.map((s) => s.id), uf);
}

/** Które filmy mają w zbiorze inny film o zbliżonej długości (tylko dla nich warto liczyć klatki). */
export function videosWithNeighbour(items: { id: string; duration: number }[], sensitivity: Sensitivity): Set<string> {
  const lim = VIDEO_LIMITS[sensitivity];
  const sorted = items.filter((v) => v.duration > 0).sort((a, b) => a.duration - b.duration);
  const near = new Set<string>();
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b.duration - a.duration <= Math.max(lim.durAbs, lim.durRel * b.duration)) {
      near.add(a.id);
      near.add(b.id);
    }
  }
  return near;
}

/** Filmy: zbliżony czas trwania + mediana różnic między klatkami z tych samych momentów. */
export function groupVideos(sigs: VideoSig[], sensitivity: Sensitivity): string[][] {
  const lim = VIDEO_LIMITS[sensitivity];
  const maxLog = Math.log1p(lim.aspect);
  const order = sigs.map((_, i) => i).sort((x, y) => sigs[x].duration - sigs[y].duration);
  const uf = new UnionFind(sigs.length);
  for (let p = 0; p < order.length; p++) {
    const a = sigs[order[p]];
    for (let q = p + 1; q < order.length; q++) {
      const b = sigs[order[q]];
      if (b.duration - a.duration > Math.max(lim.durAbs, lim.durRel * b.duration)) break;
      if (Math.abs(Math.log(a.ratio) - Math.log(b.ratio)) > maxLog) continue;
      if (meanDiff(a.mean, b.mean) > lim.mean) continue;
      const dists: number[] = [];
      for (let k = 0; k < a.frames.length; k++) {
        const fa = a.frames[k];
        const fb = b.frames[k];
        if (fa && fb) dists.push(distance(fa, fb));
      }
      dists.sort((x, y) => x - y);
      if (dists.length >= 3 && dists[dists.length >> 1] <= lim.bits) uf.union(order[p], order[q]);
    }
  }
  return collect(sigs.map((s) => s.id), uf);
}
