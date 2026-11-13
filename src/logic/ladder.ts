// Drabinka „każdy z każdym” z dogrywką, gdy na pierwszym miejscu jest remis.

export type Outcome = 'a' | 'b' | 'tie';

export interface Duel {
  a: number; // indeksy plików w grupie
  b: number;
}

export interface LadderState {
  n: number;
  schedule: Duel[];
  results: Outcome[]; // wyniki kolejnych pojedynków z schedule
  playoff: number[] | null; // liderzy z tą samą liczbą punktów (kolejność startowa dogrywki)
  playoffResults: ('a' | 'b')[];
}

export interface Standing {
  index: number;
  points: number; // wygrana 1, remis 0,5
  wins: number;
  played: number;
}

/** Metoda kołowa: każdy gra z każdym, a ten sam plik nie trafia się kilka razy pod rząd. */
export function roundRobin(n: number): Duel[] {
  if (n < 2) return [];
  const players: number[] = Array.from({ length: n }, (_, i) => i);
  if (n % 2 === 1) players.push(-1); // pauza
  const m = players.length;
  const duels: Duel[] = [];
  for (let round = 0; round < m - 1; round++) {
    for (let i = 0; i < m / 2; i++) {
      const x = players[i];
      const y = players[m - 1 - i];
      if (x >= 0 && y >= 0) duels.push({ a: Math.min(x, y), b: Math.max(x, y) });
    }
    players.splice(1, 0, players.pop() as number);
  }
  return duels;
}

export function createLadder(n: number): LadderState {
  return { n, schedule: roundRobin(n), results: [], playoff: null, playoffResults: [] };
}

export function standings(s: LadderState): Standing[] {
  const table: Standing[] = Array.from({ length: s.n }, (_, index) => ({ index, points: 0, wins: 0, played: 0 }));
  s.results.forEach((res, i) => {
    const { a, b } = s.schedule[i];
    table[a].played++;
    table[b].played++;
    if (res === 'a') {
      table[a].points += 1;
      table[a].wins++;
    } else if (res === 'b') {
      table[b].points += 1;
      table[b].wins++;
    } else {
      table[a].points += 0.5;
      table[b].points += 0.5;
    }
  });
  return table.sort((x, y) => y.points - x.points || y.wins - x.wins || x.index - y.index);
}

function leaders(s: LadderState): number[] {
  const table = standings(s);
  return table.filter((t) => t.points === table[0].points).map((t) => t.index);
}

/** Aktualny mistrz dogrywki („zwycięzca zostaje”) po dotychczasowych wynikach. */
function playoffChampion(s: LadderState): number {
  const order = s.playoff as number[];
  let champion = order[0];
  s.playoffResults.forEach((res, i) => {
    if (res === 'b') champion = order[i + 1];
  });
  return champion;
}

export interface CurrentDuel extends Duel {
  phase: 'main' | 'playoff';
  number: number; // od 1
  total: number;
}

export function mainDone(s: LadderState): boolean {
  return s.results.length >= s.schedule.length;
}

export function isFinished(s: LadderState): boolean {
  if (!mainDone(s)) return false;
  if (!s.playoff) return leaders(s).length <= 1;
  return s.playoffResults.length >= s.playoff.length - 1;
}

export function currentDuel(s: LadderState): CurrentDuel | null {
  if (!mainDone(s)) {
    const d = s.schedule[s.results.length];
    return { ...d, phase: 'main', number: s.results.length + 1, total: s.schedule.length };
  }
  if (isFinished(s)) return null;
  const order = s.playoff ?? leaders(s);
  const state = s.playoff ? s : { ...s, playoff: order };
  return {
    a: playoffChampion(state),
    b: order[state.playoffResults.length + 1],
    phase: 'playoff',
    number: state.playoffResults.length + 1,
    total: order.length - 1,
  };
}

/** Zapisuje wynik bieżącego pojedynku. W dogrywce remis nie jest dozwolony. */
export function record(s: LadderState, outcome: Outcome): LadderState {
  if (!mainDone(s)) {
    const next: LadderState = { ...s, results: [...s.results, outcome] };
    if (mainDone(next)) {
      const tied = leaders(next);
      if (tied.length > 1) next.playoff = tied;
    }
    return next;
  }
  if (isFinished(s) || !s.playoff) return s;
  if (outcome === 'tie') throw new Error('W dogrywce nie ma remisów');
  return { ...s, playoffResults: [...s.playoffResults, outcome] };
}

export function undo(s: LadderState): LadderState {
  if (s.playoffResults.length > 0) return { ...s, playoffResults: s.playoffResults.slice(0, -1) };
  if (s.results.length === 0) return s;
  return { ...s, results: s.results.slice(0, -1), playoff: null, playoffResults: [] };
}

/** Kolejność końcowa: indeksy plików od najlepszego. */
export function ranking(s: LadderState): number[] {
  const order = standings(s).map((t) => t.index);
  if (s.playoff && isFinished(s)) {
    const champion = playoffChampion(s);
    return [champion, ...order.filter((i) => i !== champion)];
  }
  return order;
}

/** Wynik pary (i, j) z punktu widzenia i: 'W' | 'L' | 'T' | null (jeszcze nie grane). */
export function pairResult(s: LadderState, i: number, j: number): 'W' | 'L' | 'T' | null {
  const k = s.schedule.findIndex((d) => (d.a === i && d.b === j) || (d.a === j && d.b === i));
  if (k < 0 || k >= s.results.length) return null;
  const res = s.results[k];
  if (res === 'tie') return 'T';
  const winner = res === 'a' ? s.schedule[k].a : s.schedule[k].b;
  return winner === i ? 'W' : 'L';
}

export const AD_EVERY = 5;
/** Reklama po każdych 5 rozstrzygniętych grupach. */
export function adDue(resolvedGroups: number): boolean {
  return resolvedGroups > 0 && resolvedGroups % AD_EVERY === 0;
}
