import { dhashFromRgba, distance, Hash } from '../hash';
import { groupPhotos, groupVideos, PhotoSig, VideoSig, videosWithNeighbour } from '../groups';
import { adDue, createLadder, currentDuel, isFinished, LadderState, Outcome, pairResult, ranking, record, roundRobin, standings, undo } from '../ladder';

function image(seed: number, noise = 0): number[] {
  // deterministyczny „obraz” 9x9: gładki wzór zależny od ziarna + opcjonalny szum
  const out: number[] = [];
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const fx = 1 + (seed % 5), fy = 1 + ((seed >> 2) % 4), ph = seed * 0.7;
  let t = seed + 1000;
  const nrnd = () => ((t = (t * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const v = 128 + 100 * Math.sin((x * fx) / 3 + ph) * Math.cos((y * fy) / 3 + ph / 2) + (rnd() - 0.5) * 30;
    const c = Math.max(0, Math.min(255, Math.round(v + nrnd() * noise)));
    out.push(c, Math.max(0, c - 10), Math.min(255, c + 10), 255);
  }
  return out;
}
const sig = (id: string, seed: number, noise = 0, ratio = 1.5): PhotoSig => {
  const r = dhashFromRgba(image(seed, noise));
  return { id, hash: r.hash, mean: r.mean, ratio };
};

describe('hash', () => {
  test('ten sam obraz = odległość 0, lekki szum = mała, inny obraz = duża', () => {
    const a = dhashFromRgba(image(1)), b = dhashFromRgba(image(1, 6)), c = dhashFromRgba(image(2));
    expect(distance(a.hash, a.hash)).toBe(0);
    expect(distance(a.hash, b.hash)).toBeLessThanOrEqual(8);
    expect(distance(a.hash, c.hash)).toBeGreaterThan(20);
  });
  test('obraz jednolity: hash zerowy, rozpiętość 0, poprawny średni kolor', () => {
    const flat = dhashFromRgba(Array.from({ length: 324 }, (_, i) => (i % 4 === 3 ? 255 : 40)));
    expect(flat.hash).toEqual([0, 0, 0, 0]);
    expect(flat.spread).toBe(0);
    expect(flat.mean).toEqual([40, 40, 40]);
  });
  test('odległość liczy wszystkie 128 bitów', () => {
    const z: Hash = [0, 0, 0, 0], f: Hash = [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff];
    expect(distance(z, f)).toBe(128);
    expect(distance([0x80000000, 0, 0, 1], z)).toBe(2);
  });
});

describe('grupowanie', () => {
  test('zdjęcia: kopie trafiają do grupy, inne i o innych proporcjach nie', async () => {
    const sigs = [sig('a1', 1), sig('x', 7), sig('a2', 1, 5), sig('b1', 3), sig('a3', 1, 4), sig('b2', 3, 5), sig('a-pion', 1, 0, 0.66)];
    const groups = (await groupPhotos(sigs, 'same')).map((g) => g.sort()).sort();
    expect(groups).toEqual([['a1', 'a2', 'a3'], ['b1', 'b2']]);
  });
  test('zdjęcia jednolite o różnych kolorach nie są duplikatami', async () => {
    const flat = (id: string, v: number): PhotoSig => {
      const r = dhashFromRgba(Array.from({ length: 324 }, (_, i) => (i % 4 === 3 ? 255 : v)));
      return { id, hash: r.hash, mean: r.mean, ratio: 1.33 };
    };
    expect(await groupPhotos([flat('czarne', 0), flat('biale', 255)], 'same')).toEqual([]);
    expect((await groupPhotos([flat('biale', 255), flat('prawie', 250)], 'same')).length).toBe(1);
  });
  test('wideo: ten sam film w innej jakości tak, przycięty i inny nie', () => {
    const frames = (seed: number, noise = 0) => [0, 1, 2, 3, 4].map((k) => dhashFromRgba(image(seed * 10 + k, noise)).hash);
    const v = (id: string, seed: number, duration: number, noise = 0): VideoSig => ({ id, duration, frames: frames(seed, noise), mean: [100, 100, 100], ratio: 16 / 9 });
    const sigs = [v('film', 1, 42), v('film-720p', 1, 42.2, 5), v('film-przyciety', 1, 20), v('inny', 2, 42.1)];
    expect(groupVideos(sigs, 'same').map((g) => g.sort())).toEqual([['film', 'film-720p']]);
    const blank: VideoSig = { id: 'czarny1', duration: 10, frames: [null, null, null, null, null], mean: [0, 0, 0], ratio: 1.78 };
    expect(groupVideos([blank, { ...blank, id: 'czarny2' }], 'same')).toEqual([]);
    expect([...videosWithNeighbour([{ id: 'a', duration: 42 }, { id: 'b', duration: 42.5 }, { id: 'c', duration: 90 }], 'same')].sort()).toEqual(['a', 'b']);
  });
});

describe('drabinka', () => {
  test.each([2, 3, 4, 5, 8, 9])('każdy z każdym dla %i plików: n(n-1)/2 unikalnych par', (n) => {
    const duels = roundRobin(n);
    expect(duels.length).toBe((n * (n - 1)) / 2);
    expect(new Set(duels.map((d) => `${d.a}-${d.b}`)).size).toBe(duels.length);
    expect(duels.every((d) => d.a < d.b && d.a >= 0 && d.b < n)).toBe(true);
  });
  const play = (n: number, pick: (a: number, b: number) => Outcome): LadderState => {
    let s = createLadder(n);
    for (let d = currentDuel(s); d; d = currentDuel(s)) s = record(s, pick(d.a, d.b));
    return s;
  };
  test('jasny zwycięzca: bez dogrywki, ranking według siły', () => {
    const s = play(4, (a, b) => (a < b ? 'a' : 'b')); // niższy indeks zawsze wygrywa
    expect(isFinished(s)).toBe(true);
    expect(s.playoff).toBeNull();
    expect(ranking(s)).toEqual([0, 1, 2, 3]);
    expect(standings(s)[0]).toMatchObject({ index: 0, points: 3, wins: 3, played: 3 });
    expect(pairResult(s, 0, 3)).toBe('W');
    expect(pairResult(s, 3, 0)).toBe('L');
  });
  test('pętla A>B>C>A: dogrywka wyłania jednego zwycięzcę', () => {
    const beats: Record<string, Outcome> = { '0-1': 'a', '1-2': 'a', '0-2': 'b' };
    let s = createLadder(3);
    for (let d = currentDuel(s); d && d.phase === 'main'; d = currentDuel(s)) s = record(s, beats[`${d.a}-${d.b}`]);
    expect(isFinished(s)).toBe(false);
    expect(s.playoff?.length).toBe(3);
    expect(() => record(s, 'tie')).toThrow();
    const first = currentDuel(s)!;
    expect(first.phase).toBe('playoff');
    expect(first.total).toBe(2);
    s = record(s, 'b'); // pretendent wygrywa
    const second = currentDuel(s)!;
    expect(second.a).toBe(first.b); // zwycięzca zostaje
    s = record(s, 'a');
    expect(isFinished(s)).toBe(true);
    expect(ranking(s)[0]).toBe(first.b);
    expect(ranking(s).slice().sort()).toEqual([0, 1, 2]);
  });
  test('same remisy: też kończy się dogrywką', () => {
    let s = createLadder(4);
    while (currentDuel(s)?.phase === 'main') s = record(s, 'tie');
    expect(s.playoff?.length).toBe(4);
    while (currentDuel(s)) s = record(s, 'a');
    expect(isFinished(s)).toBe(true);
    expect(ranking(s).length).toBe(4);
  });
  test('cofanie: wraca o jeden pojedynek, także z dogrywki do rundy głównej', () => {
    let s = createLadder(3);
    s = record(s, 'a');
    s = record(s, 'tie');
    expect(undo(s).results).toEqual(['a']);
    s = record(record(createLadder(2), 'tie'), 'a');
    expect(isFinished(s)).toBe(true);
    s = undo(s);
    expect(currentDuel(s)?.phase).toBe('playoff');
    s = undo(s);
    expect(currentDuel(s)).toMatchObject({ phase: 'main', number: 1, total: 1 });
    expect(undo(createLadder(3)).results).toEqual([]);
  });
  test('stan da się zapisać i wczytać jako JSON', () => {
    let s = createLadder(5);
    s = record(record(s, 'a'), 'b');
    const back: LadderState = JSON.parse(JSON.stringify(s));
    expect(currentDuel(back)).toEqual(currentDuel(s));
  });
  test('reklama co 5 rozstrzygniętych grup', () => {
    expect([0, 1, 4, 5, 6, 10, 15].map(adDue)).toEqual([false, false, false, true, false, true, true]);
  });
});
