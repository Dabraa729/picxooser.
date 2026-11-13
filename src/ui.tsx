import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { C } from './theme';

export function IconButton({ glyph, label, onPress, style }: { glyph: string; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[s.icon, style]} hitSlop={6}>
      <Text style={s.iconGlyph}>{glyph}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ title, onPress, color = C.keep, disabled }: { title: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.primary, { backgroundColor: disabled ? C.surface2 : color }]}>
      <Text style={[s.primaryText, disabled && { color: C.muted }]}>{title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.textBtn}>
      <Text style={s.textBtnText}>{title}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: o.value === value }} onPress={() => onChange(o.value)} style={[s.segment, o.value === value && { backgroundColor: C.text }]}>
          <Text style={[s.segmentText, { color: o.value === value ? C.bg : C.muted }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Pasek postępu: segmenty przy krótkiej drabince, ciągły przy długiej. */
export function Progress({ done, total, current = true }: { done: number; total: number; current?: boolean }) {
  if (total <= 12) {
    return (
      <View style={s.segments}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[s.seg, { backgroundColor: i < done ? C.keep : i === done && current ? C.text : C.line }]} />
        ))}
      </View>
    );
  }
  return (
    <View style={s.bar}>
      <View style={[s.barFill, { width: `${total ? Math.round((done / total) * 100) : 0}%` }]} />
    </View>
  );
}

export function RoundButton({ glyph, label, onPress, filled, disabled }: { glyph: string; label: string; onPress: () => void; filled?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={8} style={[s.roundWrap, disabled && { opacity: 0.35 }]}>
      <View style={[s.round, filled ? { backgroundColor: C.text } : { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }]}>
        <Text style={[s.roundGlyph, { color: filled ? C.bg : C.text }]}>{glyph}</Text>
      </View>
      <Text style={s.roundLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { color: C.text, fontSize: 22, fontWeight: '600', lineHeight: 26 },
  primary: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: C.bg, fontSize: 17, fontWeight: '700' },
  textBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  textBtnText: { color: C.text, fontSize: 15, fontWeight: '600' },
  segmented: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: C.surface },
  segment: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 16, fontWeight: '600' },
  segments: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 6, borderRadius: 3 },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: C.keep },
  roundWrap: { alignItems: 'center', gap: 6 },
  round: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  roundGlyph: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  roundLabel: { color: C.muted, fontSize: 12 },
});
