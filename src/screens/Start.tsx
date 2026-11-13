import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, plural } from '../theme';
import type { Kind, Session, Settings } from '../types';
import { PrimaryButton, Segmented, TextButton } from '../ui';

interface Props {
  settings: Settings;
  session: Session | null;
  demo: boolean;
  onSettings: (s: Settings) => void;
  onScan: () => void;
  onContinue: () => void;
  onNextScope: () => void;
}

export function Start({ settings, session, demo, onSettings, onScan, onContinue, onNextScope }: Props) {
  const video = settings.kind === 'video';
  const left = session ? session.groups.length - session.index : 0;
  const files = session ? session.groups.slice(session.index).reduce((n, g) => n + g.length, 0) : 0;
  const scopeLabel = settings.scope === 0 ? 'Cała biblioteka' : `Najnowsze ${settings.scope}`;
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>PicXooser</Text>
        {demo && <Text style={s.demo}>DEMO</Text>}
      </View>

      <Segmented<Kind>
        value={settings.kind}
        options={[{ value: 'photo', label: 'Zdjęcia' }, { value: 'video', label: 'Wideo' }]}
        onChange={(kind) => onSettings({ ...settings, kind })}
      />

      <View style={s.card}>
        <Text style={s.caption}>OSTATNI SKAN</Text>
        {session && left > 0 ? (
          <>
            <View style={s.bigRow}>
              <Text style={s.big}>{left}</Text>
              <Text style={s.bigLabel}>
                {plural(left, 'grupa', 'grupy', 'grup')} {video ? 'podobnych\nfilmów' : 'podobnych\nzdjęć'}
              </Text>
            </View>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statValue}>{files}</Text>
                <Text style={s.statLabel}>{video ? 'filmów do porównania' : 'zdjęć do porównania'}</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValue}>{session.scanned}</Text>
                <Text style={s.statLabel}>przeskanowanych</Text>
              </View>
            </View>
            {session.skipped > 0 && <Text style={s.note}>Pominięto {session.skipped} (oryginał tylko w iCloud albo nie do odczytu).</Text>}
          </>
        ) : (
          <Text style={s.empty}>{video ? 'Filmy nie były jeszcze skanowane.' : 'Zdjęcia nie były jeszcze skanowane.'}</Text>
        )}
      </View>

      <View style={s.rows}>
        <Pressable accessibilityRole="button" style={[s.row, s.rowLine]} onPress={() => onSettings({ ...settings, sensitivity: settings.sensitivity === 'same' ? 'similar' : 'same' })}>
          <Text style={s.rowTitle}>Czułość</Text>
          <Text style={s.rowValue}>{settings.sensitivity === 'same' ? (video ? 'Ten sam film' : 'To samo zdjęcie') : 'Także podobne'} ›</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={s.row} onPress={onNextScope}>
          <Text style={s.rowTitle}>Zakres</Text>
          <Text style={s.rowValue}>{scopeLabel} ›</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />

      {session && left > 0 ? (
        <View style={{ gap: 8 }}>
          <PrimaryButton title={session.ladder && session.ladder.results.length > 0 ? 'Kontynuuj pojedynki' : 'Zacznij pojedynki'} onPress={onContinue} />
          <TextButton title="Skanuj ponownie" onPress={onScan} />
        </View>
      ) : (
        <PrimaryButton title={video ? 'Skanuj filmy' : 'Skanuj zdjęcia'} onPress={onScan} />
      )}

      <Text style={s.footnote}>Usunięte pliki trafiają do albumu „Ostatnio usunięte” i można je przywrócić przez 30 dni.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
  title: { color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  demo: { color: C.bg, backgroundColor: C.drop, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, overflow: 'hidden' },
  card: { gap: 16, padding: 24, borderRadius: 24, backgroundColor: C.surface },
  caption: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1.2 },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  big: { color: C.text, fontSize: 76, fontWeight: '700', lineHeight: 76, letterSpacing: -2 },
  bigLabel: { color: C.text, fontSize: 17, lineHeight: 22, paddingBottom: 8 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2, padding: 14, borderRadius: 16, backgroundColor: C.surface2 },
  statValue: { color: C.text, fontSize: 22, fontWeight: '700' },
  statLabel: { color: C.muted, fontSize: 13 },
  note: { color: C.muted, fontSize: 13 },
  empty: { color: C.text, fontSize: 17, lineHeight: 24 },
  rows: { borderRadius: 20, backgroundColor: C.surface, overflow: 'hidden' },
  row: { height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowTitle: { color: C.text, fontSize: 16, fontWeight: '500' },
  rowValue: { color: C.muted, fontSize: 16 },
  footnote: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
