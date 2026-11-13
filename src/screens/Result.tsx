import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LadderState, ranking, standings } from '../logic/ladder';
import { C, letter, plural, TONES } from '../theme';
import type { MediaItem } from '../types';
import { IconButton, PrimaryButton, TextButton } from '../ui';

interface Props {
  group: MediaItem[];
  ladder: LadderState;
  groupNumber: number;
  adNext: boolean;
  busy: boolean;
  onConfirm: (deleteIds: string[]) => void;
  onLadder: () => void;
}

const fmtPoints = (p: number) => `${String(p).replace('.', ',')} pkt`;

export function Result({ group, ladder, groupNumber, adNext, busy, onConfirm, onLadder }: Props) {
  const order = useMemo(() => ranking(ladder), [ladder]);
  const points = useMemo(() => new Map(standings(ladder).map((t) => [t.index, t.points])), [ladder]);
  const [keep, setKeep] = useState<Set<number>>(() => new Set([order[0]]));
  const winner = group[order[0]];
  const video = winner.kind === 'video';
  const toDelete = order.filter((i) => !keep.has(i));
  const noun = (n: number) => (video ? plural(n, 'film', 'filmy', 'filmów') : plural(n, 'zdjęcie', 'zdjęcia', 'zdjęć'));
  const toggle = (i: number) =>
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={{ gap: 2 }}>
          <Text style={s.title}>Wynik grupy {groupNumber}</Text>
          <Text style={s.sub}>
            Rozegrane {ladder.results.length} z {ladder.schedule.length} pojedynków{ladder.playoff ? ' + dogrywka' : ''}
          </Text>
        </View>
        <IconButton glyph="▦" label="Pokaż drabinkę" onPress={onLadder} />
      </View>

      <View style={s.winner}>
        <Image source={{ uri: winner.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        <View style={s.badges}>
          <View style={s.place}><Text style={s.placeText}>1</Text></View>
          <Text style={s.keepPill}>ZOSTAJE</Text>
        </View>
        <View style={s.strip}>
          <Text style={s.stripMain}>{letter(order[0])} · {fmtPoints(points.get(order[0]) ?? 0)}</Text>
          <Text style={s.stripSide}>{winner.width} × {winner.height}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }} showsVerticalScrollIndicator={false}>
        {order.slice(1).map((i, k) => {
          const item = group[i];
          const kept = keep.has(i);
          return (
            <View key={item.id} style={s.row}>
              <View style={[s.thumb, { backgroundColor: TONES[i % TONES.length] }]}>
                <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Text style={s.thumbLetter}>{letter(i)}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.rowMain}>{k + 2}. miejsce · {fmtPoints(points.get(i) ?? 0)}</Text>
                <Text style={s.rowSide}>{item.width} × {item.height}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: !kept }} onPress={() => toggle(i)} style={[s.toggle, kept ? { borderColor: C.keep } : { borderColor: C.drop }]}>
                <Text style={[s.toggleText, { color: kept ? C.keep : C.drop }]}>{kept ? 'Zostaje' : 'Do usunięcia'}</Text>
              </Pressable>
            </View>
          );
        })}
        <Text style={s.hint}>Stuknij przycisk przy pliku, żeby go zostawić albo oznaczyć do usunięcia</Text>
      </ScrollView>

      <Text style={s.summary}>Zostaje {keep.size} · do usunięcia {toDelete.length}</Text>
      <View style={{ gap: 8 }}>
        <PrimaryButton
          color={C.text}
          disabled={busy}
          title={toDelete.length ? `Usuń ${toDelete.length} ${noun(toDelete.length)} i dalej` : 'Zostaw wszystkie i dalej'}
          onPress={() => onConfirm(toDelete.map((i) => group[i].id))}
        />
        {toDelete.length > 0 && <TextButton title="Zostaw wszystkie" onPress={() => !busy && onConfirm([])} />}
      </View>
      {adNext && <Text style={s.ad}>Po tej grupie krótka reklama.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: C.text, fontSize: 22, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 13 },
  winner: { height: 236, borderRadius: 22, borderWidth: 2, borderColor: C.keep, overflow: 'hidden', backgroundColor: '#000' },
  badges: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  place: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.keep, alignItems: 'center', justifyContent: 'center' },
  placeText: { color: C.bg, fontSize: 18, fontWeight: '700' },
  keepPill: { color: C.bg, backgroundColor: C.keep, fontSize: 12, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, overflow: 'hidden' },
  strip: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(11,13,16,0.82)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stripMain: { color: C.text, fontSize: 15, fontWeight: '600' },
  stripSide: { color: C.muted, fontSize: 13 },
  row: { height: 60, paddingHorizontal: 8, borderRadius: 16, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbLetter: { color: C.text, fontSize: 16, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 4 },
  rowMain: { color: C.text, fontSize: 15, fontWeight: '600' },
  rowSide: { color: C.muted, fontSize: 13 },
  toggle: { height: 44, paddingHorizontal: 12, borderWidth: 2, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 13, fontWeight: '600' },
  hint: { color: C.muted, fontSize: 13, textAlign: 'center', paddingTop: 6 },
  summary: { color: C.text, fontSize: 15, fontWeight: '600', paddingHorizontal: 4 },
  ad: { color: C.muted, fontSize: 12, textAlign: 'center' },
});
