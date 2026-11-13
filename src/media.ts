// Dostęp do biblioteki zdjęć iPhone'a i liczenie hashy. Wersja na przeglądarkę: media.web.ts (dane demo).
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ML from 'expo-media-library/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import UPNG from 'upng-js';

import { FLAT_FRAME, FRAME_POSITIONS } from './logic/groups';
import type { Hash, HashResult, RGB } from './logic/hash';
import { base64ToBytes, hashPixels } from './pixels';
import type { Kind, MediaItem } from './types';

export const isDemo = false;

export type Access = 'granted' | 'limited' | 'denied';

export async function requestAccess(): Promise<Access> {
  const res = await ML.requestPermissionsAsync(false);
  if (!res.granted) return 'denied';
  return res.accessPrivileges === 'limited' ? 'limited' : 'granted';
}

/** Najnowsze pliki danego rodzaju; limit 0 = cała biblioteka. */
export async function listMedia(kind: Kind, limit: number, onProgress?: (n: number) => void): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await ML.getAssetsAsync({
      first: 500,
      after,
      mediaType: kind === 'photo' ? ML.MediaType.photo : ML.MediaType.video,
      sortBy: [[ML.SortBy.creationTime, false]],
    });
    for (const a of page.assets) {
      if (a.width > 0 && a.height > 0) {
        items.push({
          id: a.id, uri: a.uri, kind, width: a.width, height: a.height, duration: a.duration,
          created: a.creationTime, modified: a.modificationTime, filename: a.filename,
        });
      }
    }
    onProgress?.(items.length);
    if (!page.hasNextPage || page.assets.length === 0 || (limit > 0 && items.length >= limit)) break;
    after = page.endCursor;
  }
  return limit > 0 ? items.slice(0, limit) : items;
}

function discard(uri: string | undefined) {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {}
}

/** Zmniejsza obraz do 9×9 i liczy hash. */
async function hashImage(uri: string): Promise<HashResult> {
  const context = ImageManipulator.manipulate(uri).resize({ width: 9, height: 9 });
  const ref = await context.renderAsync();
  try {
    const saved = await ref.saveAsync({ format: SaveFormat.PNG, base64: true });
    discard(saved.uri);
    const bytes = base64ToBytes(saved.base64 ?? '');
    const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    return hashPixels(new Uint8Array(UPNG.toRGBA8(png)[0]), png.width, png.height);
  } finally {
    ref.release();
    context.release();
  }
}

/** Plik na dysku telefonu; null, gdy oryginał jest tylko w iCloud. */
export async function localUri(item: MediaItem): Promise<string | null> {
  try {
    const info = await ML.getAssetInfoAsync(item.id, { shouldDownloadFromNetwork: false });
    return info.localUri ?? null;
  } catch {
    return null;
  }
}

export async function photoSignature(item: MediaItem): Promise<{ hash: Hash; mean: RGB } | null> {
  const uri = await localUri(item);
  if (!uri) return null;
  try {
    const { hash, mean } = await hashImage(uri);
    return { hash, mean };
  } catch {
    return null;
  }
}

export async function videoSignature(item: MediaItem): Promise<{ frames: (Hash | null)[]; mean: RGB } | null> {
  const uri = await localUri(item);
  if (!uri) return null;
  const frames: (Hash | null)[] = [];
  const sums = [0, 0, 0];
  let used = 0;
  for (const position of FRAME_POSITIONS) {
    try {
      const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: Math.round(item.duration * position * 1000), quality: 0.4 });
      const res = await hashImage(thumb.uri);
      discard(thumb.uri);
      frames.push(res.spread >= FLAT_FRAME ? res.hash : null);
      res.mean.forEach((v, k) => (sums[k] += v));
      used++;
    } catch {
      frames.push(null);
    }
  }
  if (!used) return null;
  return { frames, mean: [Math.floor(sums[0] / used), Math.floor(sums[1] / used), Math.floor(sums[2] / used)] };
}

/** Klatka filmu z podanej sekundy (do podglądu w pojedynku). */
export async function frameUri(item: MediaItem, seconds: number): Promise<string | null> {
  const uri = await localUri(item);
  if (!uri) return null;
  try {
    return (await VideoThumbnails.getThumbnailAsync(uri, { time: Math.round(seconds * 1000), quality: 0.8 })).uri;
  } catch {
    return null;
  }
}

/** Usuwa pliki z biblioteki (iOS pyta o zgodę i przenosi je do „Ostatnio usunięte”). false = anulowano. */
export async function deleteItems(ids: string[]): Promise<boolean> {
  try {
    return await ML.deleteAssetsAsync(ids);
  } catch {
    return false;
  }
}
