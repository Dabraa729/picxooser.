import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { currentDuel, LadderState, Outcome } from '../logic/ladder';
import { frameUri, isDemo, localUri } from '../media';
import { C, fmtDate, fmtDuration, letter, plural } from '../theme';
import type { MediaItem } from '../types';
import { IconButton, Progress, RoundButton } from '../ui';

interface Props {
  group: MediaItem[];
  ladder: LadderState;
  groupNumber: number;
  groupTotal: number;
  onOutcome: (o: Outcome) => void;
  onUndo: () => void;
  onLadder: () => void;
  onClose: () => void;
}

const SWIPE = 110; // o tyle trzeba zsunąć kartę, żeby odpadła

function Card({ item, uri, name, tag, onWin, onLose, onPlay }: { item: MediaItem; uri: string | null; name: string; tag: string | null; onWin: () => void; onLose: () => void; onPlay?: () => void }) {
  const x = useRef(new Animated.Value(0)).current;
  const handlers = useRef({ onWin, onLose });
  handlers.current = { onWin, onLose };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => x.setValue(g.dx),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > SWIPE) {
            Animated.timing(x, { toValue: Math.sign(g.dx) * 520, duration: 170, useNativeDriver: false }).start(() => handlers.current.onLose());
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
            if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) handlers.current.onWin();
          }
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
      }),
    [x],
  );
  const rotate = x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-7deg', '0deg', '7deg'] });
  const stamp = x.interpolate({ inputRange: [-SWIPE, -30, 30, SWIPE], outputRange: [1, 0, 0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={`Wygrywa ${name}`}
      style={[s.card, { transform: [{ translateX: x }, { rotate }] }]}>
      {uri ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
        </View>
      ) : (
        <Text style={s.loading}>Wczytywanie…</Text>
      )}
      <View style={s.letter}><Text style={s.letterText}>{name}</Text></View>
      {item.kind === 'video' && <Text style={s.duration}>{fmtDuration(item.duration)}</Text>}
      {onPlay && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Odtwórz film ${name}`} onPress={onPlay} style={s.play} hitSlop={8}>
          <Text style={s.playGlyph}>▶</Text>
        </Pressable>
      )}
      <Animated.View pointerEvents="none" style={[s.stamp, { opacity: stamp }]}><Text style={s.stampText}>ODPADA</Text></Animated.View>
      <View style={s.strip} pointerEvents="none">
        <Text style={s.stripMain}>{item.width} × {item.height} · {fmtDate(item.created)}</Text>
        {tag && <Text style={s.stripTag}>{tag}</Text>}
      </View>
    </Animated.View>
  );
}

function Scrubber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;
  const at = (x: number) => Math.max(0, Math.min(1, x / width));
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Moment filmu"
      style={s.scrub}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => setDrag(at(e.nativeEvent.locationX))}
      onResponderMove={(e) => setDrag(at(e.nativeEvent.locationX))}
      onResponderRelease={(e) => {
        onChange(at(e.nativeEvent.locationX));
        setDrag(null);
      }}>
      <View pointerEvents="none" style={s.scrubTrack}>
        <View style={[s.scrubFill, { width: `${shown * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[s.scrubKnob, { left: shown * (width - 22) }]} />
    </View>
  );
}

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />;
}

function VideoModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const [uri, setUri] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    localUri(item).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [item]);
  return (
    <Modal animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={s.modal}>
        {uri ? <Player uri={uri} /> : <Text style={s.loading}>{uri === null ? 'Tego filmu nie ma na telefonie (tylko iCloud).' : 'Wczytywanie…'}</Text>}
        <IconButton glyph="×" label="Zamknij" onPress={onClose} style={s.modalClose} />
      </View>
    </Modal>
  );
}

function ZoomModal({ items, onClose }: { items: { name: string; uri: string | null }[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const uri = items[index].uri;
  return (
    <Modal animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={s.modal}>
        <ScrollView key={index} style={{ flex: 1 }} contentContainerStyle={{ flex: 1 }} maximumZoomScale={5} minimumZoomScale={1} centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
          {uri && <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" />}
        </ScrollView>
        <IconButton glyph="×" label="Zamknij" onPress={onClose} style={s.modalClose} />
        <View style={s.zoomSwitch}>
          {items.map((it, i) => (
            <Pressable key={it.name} accessibilityRole="button" onPress={() => setIndex(i)} style={[s.zoomBtn, i === index && { backgroundColor: C.text }]}>
              <Text style={[s.zoomBtnText, { color: i === index ? C.bg : C.text }]}>{it.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

export function Duel({ group, ladder, groupNumber, groupTotal, onOutcome, onUndo, onLadder, onClose }: Props) {
  const duel = currentDuel(ladder);
  const [fraction, setFraction] = useState(0.3);
  const [frames, setFrames] = useState<Record<string, string | null>>({});
  const [playing, setPlaying] = useState<MediaItem | null>(null);
  const [zoom, setZoom] = useState(false);
  const a = duel ? group[duel.a] : null;
  const b = duel ? group[duel.b] : null;
  const video = group[0]?.kind === 'video';

  useEffect(() => {
    if (!video || !a || !b) return;
    let alive = true;
    for (const item of [a, b]) {
      const key = `${item.id}@${fraction}`;
      if (frames[key] !== undefined) continue;
      frameUri(item, item.duration * fraction).then((uri) => alive && setFrames((prev) => ({ ...prev, [key]: uri })));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, a?.id, b?.id, fraction]);

  if (!duel || !a || !b) return null;
  const uriOf = (item: MediaItem) => (video ? frames[`${item.id}@${fraction}`] ?? null : item.uri);
  const pa = a.width * a.height;
  const pb = b.width * b.height;
  const noun = video ? plural(group.length, 'podobny film', 'podobne filmy', 'podobnych filmów') : plural(group.length, 'podobne zdjęcie', 'podobne zdjęcia', 'podobnych zdjęć');
  const playoff = duel.phase === 'playoff';
  const key = `${duel.phase}-${duel.number}`;
  const canUndo = ladder.results.length > 0;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <IconButton glyph="×" label="Zamknij pojedynki" onPress={onClose} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={s.title}>{video ? 'Wideo · grupa' : 'Grupa'} {groupNumber} z {groupTotal}</Text>
          <Text style={s.sub}>{group.length} {noun}</Text>
        </View>
        <IconButton glyph="▦" label="Pokaż drabinkę" onPress={onLadder} />
      </View>

      <View style={{ gap: 8 }}>
        <View style={s.progressRow}>
          <Text style={s.sub}>{playoff ? `Dogrywka ${duel.number} z ${duel.total}` : `Pojedynek ${duel.number} z ${duel.total}`}</Text>
          <Text style={s.sub}>{letter(duel.a)} kontra {letter(duel.b)}</Text>
        </View>
        <Progress done={duel.number - 1} total={duel.total} />
      </View>

      <View style={s.cards}>
        <Card key={`${key}-a`} item={a} uri={uriOf(a)} name={letter(duel.a)} tag={pa > pb ? 'wyższa rozdzielczość' : null} onWin={() => onOutcome('a')} onLose={() => onOutcome('b')} onPlay={video && !isDemo ? () => setPlaying(a) : undefined} />
        <View style={s.vsRow} pointerEvents="none"><View style={s.vs}><Text style={s.vsText}>VS</Text></View></View>
        <Card key={`${key}-b`} item={b} uri={uriOf(b)} name={letter(duel.b)} tag={pb > pa ? 'wyższa rozdzielczość' : null} onWin={() => onOutcome('b')} onLose={() => onOutcome('a')} onPlay={video && !isDemo ? () => setPlaying(b) : undefined} />
      </View>

      {video ? (
        <View style={s.moment}>
          <View style={s.progressRow}>
            <Text style={s.momentTitle}>Ten sam moment w obu filmach</Text>
            <Text style={s.sub}>{Math.round(fraction * 100)}%</Text>
          </View>
          <Scrubber value={fraction} onChange={(v) => setFraction(Math.round(v * 20) / 20)} />
        </View>
      ) : (
        <Text style={s.hint}>{playoff ? 'Dogrywka o pierwsze miejsce: wybierz jedno' : 'Stuknij lepsze zdjęcie albo zsuń gorsze z ekranu'}</Text>
      )}

      <View style={s.actions}>
        <RoundButton glyph="↶" label="Cofnij" onPress={onUndo} disabled={!canUndo} />
        <RoundButton glyph="=" label="Remis" onPress={() => onOutcome('tie')} filled disabled={playoff} />
        <RoundButton glyph="⊕" label="Powiększ" onPress={() => setZoom(true)} />
      </View>

      {playing && <VideoModal item={playing} onClose={() => setPlaying(null)} />}
      {zoom && <ZoomModal items={[{ name: letter(duel.a), uri: uriOf(a) }, { name: letter(duel.b), uri: uriOf(b) }]} onClose={() => setZoom(false)} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: C.text, fontSize: 18, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 13 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cards: { flex: 1, gap: 14 },
  card: { flex: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  loading: { color: C.muted, fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 24 },
  letter: { position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  letterText: { color: C.text, fontSize: 18, fontWeight: '700' },
  duration: { position: 'absolute', top: 14, left: 56, color: C.text, backgroundColor: C.bg, fontSize: 13, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
  play: { position: 'absolute', top: 10, right: 10, width: 48, height: 48, borderRadius: 24, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  playGlyph: { color: C.text, fontSize: 18, marginLeft: 3 },
  stamp: { position: 'absolute', top: 60, alignSelf: 'center', borderWidth: 3, borderColor: C.drop, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: 'rgba(11,13,16,0.75)', transform: [{ rotate: '-10deg' }] },
  stampText: { color: C.drop, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  strip: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(11,13,16,0.82)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stripMain: { color: C.text, fontSize: 13 },
  stripTag: { color: C.keep, fontSize: 13, fontWeight: '600' },
  vsRow: { height: 0, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  vs: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: C.bg, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' },
  vsText: { color: C.bg, fontSize: 13, fontWeight: '700' },
  hint: { color: C.muted, fontSize: 13, textAlign: 'center' },
  moment: { gap: 2, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, borderRadius: 18, backgroundColor: C.surface },
  momentTitle: { color: C.text, fontSize: 13, fontWeight: '600' },
  scrub: { height: 44, justifyContent: 'center' },
  scrubTrack: { height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
  scrubFill: { height: 6, backgroundColor: C.keep },
  scrubKnob: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: C.text },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 36 },
  modal: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  modalClose: { position: 'absolute', top: 56, right: 16 },
  zoomSwitch: { position: 'absolute', bottom: 44, alignSelf: 'center', flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: 'rgba(20,23,28,0.92)' },
  zoomBtn: { width: 56, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  zoomBtnText: { fontSize: 16, fontWeight: '700' },
});
