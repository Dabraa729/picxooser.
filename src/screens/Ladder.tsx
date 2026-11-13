import React from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { currentDuel, isFinished, LadderState, mainDone, pairResult, standings } from '../logic/ladder';
import { C, letter, plural, TONES } from '../theme';
import type { MediaItem } from '../types';
import { IconButton, PrimaryButton, Progress } from '../ui';

interface Props {
  group: MediaItem[];
  ladder: LadderState;
  groupNumber: number;
  onBack: () => void;
}

const fmtPoints = (p: number) => `${String(p).replace('.', ',')} pkt`;

export function Ladder({ group, ladder, groupNumber, onBack }: Props) {
  const { width } = useWindowDimensions();
  const n = group.length;
  const now = currentDuel(ladder);
  const gap = n > 6 ? 4 : 6;
  const cell = Math.max(28, Math.min(52, Math.floor((width - 32 - 28 - gap * n) / (n + 1))));
  const fits = (cell + gap) * (n + 1) <= width - 32 - 28 + gap;
  const table = standings(ladder);
  const video = group[0]?.kind === 'video';

  const cellFor = (r: number, c: number) => {
    const base = { width: cell, height: cell, borderRadius: cell > 40 ? 12 : 8 };
    if (r === c) return <View key={c} style={[base, { backgroundColor: C.bg }]} />;
    const res = pairResult(ladder, r, c);
    const live = now?.phase === 'main' && ((now.a === r && now.b === c) || (now.a === c && now.b === r));
    if (res === 'W') return <View key={c} accessibilityLabel={`${letter(r)} wygrało z ${letter(c)}`} style={[base, s.center, { backgroundColor: C.keep }]}><Text style={[s.mark, { color: C.bg }]}>✓</Text></View>;
    if (res === 'L') return <View key={c} accessibilityLabel={`${letter(r)} przegrało z ${letter(c)}`} style={[base, s.center, { backgroundColor: C.surface2, borderWidth: 2, borderColor: C.drop }]}><Text style={[s.mark, { color: C.drop }]}>×</Text></View>;
    if (res === 'T') return <View key={c} accessibilityLabel={`${letter(r)} zremisowało z ${letter(c)}`} style={[base, s.center, { backgroundColor: C.tie }]}><Text style={[s.mark, { color: C.text }]}>=</Text></View>;
    if (live) return <View key={c} accessibilityLabel={`${letter(r)} kontra ${letter(c)}: trwa`} style={[base, { backgroundColor: C.surface2, borderWidth: 2, borderColor: C.text }]} />;
    return <View key={c} style={[base, s.center, { backgroundColor: C.surface2 }]}><View style={s.dot} /></View>;
  };
  const head = (i: number) => (
    <View key={`h${i}`} style={[s.center, { width: cell, height: cell, borderRadius: cell > 40 ? 12 : 8, backgroundColor: TONES[i % TONES.length] }]}>
      <Text style={[s.head, cell < 36 && { fontSize: 13 }]}>{letter(i)}</Text>
    </View>
  );
  const matrix = (
    <View style={{ gap }}>
      <View style={{ flexDirection: 'row', gap }}>
        <View style={{ width: cell, height: cell }} />
        {group.map((_, i) => head(i))}
      </View>
      {group.map((_, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {head(r)}
          {group.map((__, c) => cellFor(r, c))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <IconButton glyph="‹" label="Wróć" onPress={onBack} />
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={s.title}>Drabinka</Text>
          <Text style={s.sub}>
            Grupa {groupNumber} · {n} {video ? plural(n, 'film', 'filmy', 'filmów') : plural(n, 'zdjęcie', 'zdjęcia', 'zdjęć')} · rozegrane {ladder.results.length} z {ladder.schedule.length}
          </Text>
        </View>
      </View>
      <Progress done={ladder.results.length} total={ladder.schedule.length} current={!mainDone(ladder)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          {fits ? matrix : <ScrollView horizontal showsHorizontalScrollIndicator={false}>{matrix}</ScrollView>}
          <View style={s.legend}>
            <View style={s.legendItem}><View style={[s.sw, { backgroundColor: C.keep }]} /><Text style={s.legendText}>wygrana</Text></View>
            <View style={s.legendItem}><View style={[s.sw, { borderWidth: 2, borderColor: C.drop }]} /><Text style={s.legendText}>przegrana</Text></View>
            <View style={s.legendItem}><View style={[s.sw, { backgroundColor: C.tie }]} /><Text style={s.legendText}>remis</Text></View>
            <View style={s.legendItem}><View style={s.dot} /><Text style={s.legendText}>czeka</Text></View>
          </View>
        </View>

        {ladder.playoff && (
          <Text style={s.playoff}>
            Remis na szczycie: dogrywka między {ladder.playoff.map(letter).join(', ')} ({ladder.playoffResults.length} z {ladder.playoff.length - 1}).
          </Text>
        )}

        <View style={{ gap: 6 }}>
          <Text style={s.caption}>TABELA · WYGRANA 1 PKT, REMIS 0,5</Text>
          {table.map((t, place) => (
            <View key={t.index} style={s.row}>
              <View style={[s.thumb, { backgroundColor: TONES[t.index % TONES.length] }]}><Text style={s.thumbText}>{letter(t.index)}</Text></View>
              <Text style={s.rowMain}>{place + 1}. miejsce · {fmtPoints(t.points)}</Text>
              <Text style={s.rowSide}>{t.played ? `rozegrane ${t.played} z ${n - 1}` : 'jeszcze nie grało'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <PrimaryButton
        title={isFinished(ladder) ? 'Zobacz wynik' : now ? `Wróć do pojedynku: ${letter(now.a)} kontra ${letter(now.b)}` : 'Wróć'}
        onPress={onBack}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: C.text, fontSize: 22, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 13 },
  card: { gap: 12, padding: 14, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { color: C.text, fontSize: 17, fontWeight: '700' },
  mark: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted },
  legend: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: C.muted, fontSize: 12 },
  sw: { width: 10, height: 10, borderRadius: 3 },
  playoff: { color: C.text, fontSize: 14, lineHeight: 20 },
  caption: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1.2 },
  row: { height: 46, paddingLeft: 8, paddingRight: 14, borderRadius: 14, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  thumbText: { color: C.text, fontSize: 15, fontWeight: '700' },
  rowMain: { flex: 1, color: C.text, fontSize: 15, fontWeight: '600' },
  rowSide: { color: C.muted, fontSize: 13 },
});
