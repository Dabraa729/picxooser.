import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasNativeAds, initAds, showAd } from './src/ads';
import { adDue, createLadder, isFinished, Outcome, record, undo } from './src/logic/ladder';
import { deleteItems, isDemo, requestAccess } from './src/media';
import { scan, ScanCancelled, ScanProgress } from './src/scan';
import { Duel } from './src/screens/Duel';
import { Ladder } from './src/screens/Ladder';
import { Result } from './src/screens/Result';
import { Start } from './src/screens/Start';
import { load, remove, save } from './src/storage';
import { C, plural } from './src/theme';
import { DEFAULT_SETTINGS, Kind, SCOPES, Session, Settings } from './src/types';
import { PrimaryButton, Progress, TextButton } from './src/ui';

type Screen = 'loading' | 'start' | 'scan' | 'duel' | 'ladder' | 'result' | 'message';

const sessionKey = (kind: Kind) => `session:${kind}`;

function Root() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('loading');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState<Record<Kind, Session | null>>({ photo: null, video: null });
  const [resolved, setResolved] = useState(0);
  const [progress, setProgress] = useState<ScanProgress>({ stage: 'list', done: 0, total: 0 });
  const [message, setMessage] = useState({ title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [demoAd, setDemoAd] = useState<(() => void) | null>(null);
  const [backTo, setBackTo] = useState<'duel' | 'result'>('duel');
  const cancelled = useRef(false);

  const session = sessions[settings.kind];
  const group = session ? session.groups[session.index] : null;

  useEffect(() => {
    (async () => {
      const [st, photo, video, count] = await Promise.all([
        load<Settings>('settings', DEFAULT_SETTINGS),
        load<Session | null>(sessionKey('photo'), null),
        load<Session | null>(sessionKey('video'), null),
        load<number>('resolved', 0),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...st });
      setSessions({ photo, video });
      setResolved(count);
      setScreen('start');
      initAds();
    })();
  }, []);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    save('settings', next);
  }, []);

  const putSession = useCallback((kind: Kind, next: Session | null) => {
    setSessions((prev) => ({ ...prev, [kind]: next }));
    if (next) save(sessionKey(kind), next);
    else remove(sessionKey(kind));
  }, []);

  const startScan = useCallback(async () => {
    const kind = settings.kind;
    const access = await requestAccess();
    if (access === 'denied') {
      Alert.alert('Brak dostępu do Zdjęć', 'PicXooser potrzebuje dostępu do biblioteki, żeby znaleźć duplikaty. Włącz go w Ustawieniach.', [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Ustawienia', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    cancelled.current = false;
    setProgress({ stage: 'list', done: 0, total: 0 });
    setScreen('scan');
    try {
      const res = await scan(kind, settings.sensitivity, settings.scope, setProgress, () => cancelled.current);
      const what = kind === 'video' ? plural(res.scanned, 'film', 'filmy', 'filmów') : plural(res.scanned, 'zdjęcie', 'zdjęcia', 'zdjęć');
      if (res.groups.length === 0) {
        putSession(kind, null);
        setMessage({ title: 'Brak duplikatów', body: `Sprawdzono ${res.scanned} ${what}.${res.skipped ? ` Pominięto ${res.skipped} (tylko w iCloud albo nie do odczytu).` : ''}` });
        setScreen('message');
        return;
      }
      putSession(kind, { kind, groups: res.groups, index: 0, ladder: createLadder(res.groups[0].length), scanned: res.scanned, skipped: res.skipped });
      setScreen('duel');
    } catch (err) {
      if (!(err instanceof ScanCancelled)) Alert.alert('Skanowanie nie powiodło się', String((err as Error)?.message ?? err));
      setScreen('start');
    }
  }, [settings, putSession]);

  const continueSession = useCallback(() => {
    if (!session) return;
    const ladder = session.ladder ?? createLadder(session.groups[session.index].length);
    if (!session.ladder) putSession(session.kind, { ...session, ladder });
    setScreen(isFinished(ladder) ? 'result' : 'duel');
  }, [session, putSession]);

  const onOutcome = useCallback(
    (outcome: Outcome) => {
      if (!session?.ladder) return;
      const ladder = record(session.ladder, outcome);
      putSession(session.kind, { ...session, ladder });
      if (isFinished(ladder)) setScreen('result');
    },
    [session, putSession],
  );

  const onUndo = useCallback(() => {
    if (!session?.ladder) return;
    putSession(session.kind, { ...session, ladder: undo(session.ladder) });
    setScreen('duel');
  }, [session, putSession]);

  const resolveGroup = useCallback(
    async (deleteIds: string[]) => {
      if (!session || busy) return;
      setBusy(true);
      try {
        if (deleteIds.length && !(await deleteItems(deleteIds))) return; // anulowano w oknie systemowym
        const count = resolved + 1;
        setResolved(count);
        save('resolved', count);
        if (adDue(count)) {
          if (hasNativeAds) await showAd();
          else await new Promise<void>((resolve) => setDemoAd(() => resolve));
          setDemoAd(null);
        }
        const index = session.index + 1;
        if (index >= session.groups.length) {
          putSession(session.kind, null);
          setMessage({ title: 'Gotowe', body: 'Wszystkie grupy zostały rozstrzygnięte.' });
          setScreen('message');
        } else {
          putSession(session.kind, { ...session, index, ladder: createLadder(session.groups[index].length) });
          setScreen('duel');
        }
      } finally {
        setBusy(false);
      }
    },
    [session, busy, resolved, putSession],
  );

  const stageText = { list: 'Czytam bibliotekę…', analyze: settings.kind === 'video' ? 'Analizuję klatki filmów…' : 'Analizuję zdjęcia…', group: 'Szukam duplikatów…' }[progress.stage];

  return (
    <View style={[s.app, { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
      <StatusBar style="light" />
      {screen === 'start' && (
        <Start
          settings={settings}
          session={session}
          demo={isDemo}
          onSettings={updateSettings}
          onScan={startScan}
          onContinue={continueSession}
          onNextScope={() => updateSettings({ ...settings, scope: SCOPES[(SCOPES.indexOf(settings.scope) + 1) % SCOPES.length] })}
        />
      )}
      {screen === 'scan' && (
        <View style={s.center}>
          <Text style={s.title}>{stageText}</Text>
          <Text style={s.body}>{progress.total ? `${progress.done} z ${progress.total}` : progress.done ? String(progress.done) : ' '}</Text>
          <View style={{ alignSelf: 'stretch' }}><Progress done={progress.done} total={Math.max(progress.total, 13)} /></View>
          <Text style={s.note}>Pierwszy skan trwa najdłużej. Wyniki są zapamiętywane, więc kolejne będą szybsze.</Text>
          <TextButton title="Anuluj" onPress={() => (cancelled.current = true)} />
        </View>
      )}
      {screen === 'duel' && session?.ladder && group && (
        <Duel
          group={group}
          ladder={session.ladder}
          groupNumber={session.index + 1}
          groupTotal={session.groups.length}
          onOutcome={onOutcome}
          onUndo={onUndo}
          onLadder={() => {
            setBackTo('duel');
            setScreen('ladder');
          }}
          onClose={() => setScreen('start')}
        />
      )}
      {screen === 'ladder' && session?.ladder && group && (
        <Ladder group={group} ladder={session.ladder} groupNumber={session.index + 1} onBack={() => setScreen(isFinished(session.ladder!) ? 'result' : backTo)} />
      )}
      {screen === 'result' && session?.ladder && group && (
        <Result
          key={session.index}
          group={group}
          ladder={session.ladder}
          groupNumber={session.index + 1}
          adNext={adDue(resolved + 1)}
          busy={busy}
          onConfirm={resolveGroup}
          onLadder={() => {
            setBackTo('result');
            setScreen('ladder');
          }}
        />
      )}
      {screen === 'message' && (
        <View style={s.center}>
          <Text style={s.title}>{message.title}</Text>
          <Text style={s.body}>{message.body}</Text>
          <View style={{ alignSelf: 'stretch' }}><PrimaryButton title="Wróć na start" onPress={() => setScreen('start')} /></View>
        </View>
      )}
      <Modal visible={demoAd !== null} animationType="fade" presentationStyle="fullScreen">
        <View style={[s.app, s.center, { padding: 24 }]}>
          <Text style={s.adTag}>REKLAMA (DEMO)</Text>
          <Text style={s.body}>W aplikacji na iPhonie w tym miejscu pojawia się pełnoekranowa reklama: po każdych 5 rozstrzygniętych grupach.</Text>
          <View style={{ alignSelf: 'stretch' }}><PrimaryButton title="Dalej" onPress={() => demoAd?.()} /></View>
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  title: { color: C.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  body: { color: C.muted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  note: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  adTag: { color: C.muted, backgroundColor: C.surface, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, overflow: 'hidden' },
});
