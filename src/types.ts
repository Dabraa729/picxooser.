import type { Sensitivity } from './logic/groups';
import type { LadderState } from './logic/ladder';

export type Kind = 'photo' | 'video';

export interface MediaItem {
  id: string;
  uri: string;
  kind: Kind;
  width: number;
  height: number;
  duration: number; // sekundy (wideo)
  created: number; // ms
  modified: number; // ms
  filename: string;
}

export interface Settings {
  kind: Kind;
  sensitivity: Sensitivity;
  scope: number; // ile najnowszych plików skanować; 0 = cała biblioteka
}

/** Zapisany stan pracy: wyniki skanu i postęp drabinki bieżącej grupy. */
export interface Session {
  kind: Kind;
  groups: MediaItem[][];
  index: number;
  ladder: LadderState | null;
  scanned: number;
  skipped: number;
}

export const DEFAULT_SETTINGS: Settings = { kind: 'photo', sensitivity: 'same', scope: 1000 };
export const SCOPES = [1000, 5000, 0];
