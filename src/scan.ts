import { groupPhotos, groupVideos, PhotoSig, Sensitivity, VideoSig, videosWithNeighbour } from './logic/groups';
import type { Hash, RGB } from './logic/hash';
import { listMedia, photoSignature, videoSignature } from './media';
import { load, save } from './storage';
import type { Kind, MediaItem } from './types';

export interface ScanProgress {
  stage: 'list' | 'analyze' | 'group';
  done: number;
  total: number;
}

export interface ScanResult {
  groups: MediaItem[][];
  scanned: number;
  skipped: number; // nie udało się odczytać (np. oryginał tylko w iCloud)
}

type PhotoEntry = { t: number; h: Hash; m: RGB };
type VideoEntry = { t: number; f: (Hash | null)[]; m: RGB };

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function pool<T>(items: T[], workers: number, job: (item: T) => Promise<void>, cancelled: () => boolean) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (next < items.length && !cancelled()) await job(items[next++]);
    }),
  );
}

export class ScanCancelled extends Error {}

/** Lista plików -> hashe (z pamięcią podręczną między skanami) -> grupy duplikatów. */
export async function scan(
  kind: Kind,
  sensitivity: Sensitivity,
  scope: number,
  onProgress: (p: ScanProgress) => void,
  cancelled: () => boolean,
): Promise<ScanResult> {
  onProgress({ stage: 'list', done: 0, total: 0 });
  const items = await listMedia(kind, scope, (n) => onProgress({ stage: 'list', done: n, total: 0 }));
  const byId = new Map(items.map((i) => [i.id, i]));
  let skipped = 0;
  let idGroups: string[][];

  if (kind === 'photo') {
    const cacheKey = 'sigs:photo:v1';
    const cache = await load<Record<string, PhotoEntry>>(cacheKey, {});
    const sigs: PhotoSig[] = [];
    let done = 0;
    await pool(items, 4, async (item) => {
      let entry: PhotoEntry | undefined = cache[item.id];
      if (!entry || entry.t !== item.modified) {
        const sig = await photoSignature(item);
        entry = sig ? { t: item.modified, h: sig.hash, m: sig.mean } : undefined;
        if (entry) cache[item.id] = entry;
      }
      if (entry) sigs.push({ id: item.id, hash: entry.h, mean: entry.m, ratio: item.width / item.height });
      else skipped++;
      done++;
      if (done % 10 === 0 || done === items.length) onProgress({ stage: 'analyze', done, total: items.length });
      if (done % 300 === 0) await save(cacheKey, cache);
    }, cancelled);
    await save(cacheKey, cache);
    if (cancelled()) throw new ScanCancelled();
    onProgress({ stage: 'group', done: 0, total: sigs.length });
    idGroups = await groupPhotos(sigs, sensitivity, async (i, total) => {
      if (cancelled()) throw new ScanCancelled();
      onProgress({ stage: 'group', done: i, total });
      await pause();
    });
  } else {
    const cacheKey = 'sigs:video:v1';
    const cache = await load<Record<string, VideoEntry>>(cacheKey, {});
    const near = videosWithNeighbour(items, sensitivity);
    const candidates = items.filter((i) => near.has(i.id));
    const sigs: VideoSig[] = [];
    let done = 0;
    await pool(candidates, 2, async (item) => {
      let entry: VideoEntry | undefined = cache[item.id];
      if (!entry || entry.t !== item.modified) {
        const sig = await videoSignature(item);
        entry = sig ? { t: item.modified, f: sig.frames, m: sig.mean } : undefined;
        if (entry) cache[item.id] = entry;
      }
      if (entry) sigs.push({ id: item.id, duration: item.duration, frames: entry.f, mean: entry.m, ratio: item.width / item.height });
      else skipped++;
      done++;
      onProgress({ stage: 'analyze', done, total: candidates.length });
    }, cancelled);
    await save(cacheKey, cache);
    if (cancelled()) throw new ScanCancelled();
    onProgress({ stage: 'group', done: 0, total: sigs.length });
    idGroups = groupVideos(sigs, sensitivity);
  }

  const groups = idGroups
    .map((ids) =>
      ids
        .map((id) => byId.get(id) as MediaItem)
        .sort((a, b) => b.width * b.height - a.width * a.height || a.created - b.created),
    )
    .sort((a, b) => Math.max(...b.map((i) => i.created)) - Math.max(...a.map((i) => i.created)));
  return { groups, scanned: items.length, skipped };
}
