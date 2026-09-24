import React, {useEffect, useState} from 'react';
import {Alert, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {createRoom, messagesForRoom, roomsForSpirit, sendMessage} from './domains/chat/service';
import {ChatView} from './domains/chat/ui/ChatView';
import {MemoryView} from './domains/chat/ui/MemoryView';
import {GuideView} from './domains/guide/ui/GuideView';
import {SpiritRoster} from './domains/persona/ui/SpiritRoster';
import {labels} from './domains/settings/labels';
import {readSettings, saveSettings} from './domains/settings/repository';
import {SettingsView} from './domains/settings/ui/SettingsView';
import {StorageView} from './domains/sync/ui/StorageView';
import {StoryView} from './domains/story/ui/StoryView';
import {
  localizedDescription,
  localizedGreeting,
  localizedName,
  nativeApi,
  type ChatMessage,
  type ChatRoom,
  type Language,
  type NativeSettings,
  type SpiritDetail,
  type SpiritSummary,
} from './shared/native';
import {colors} from './shared/theme';
import {ActionButton} from './shared/ui/ActionButton';
import {Panel} from './shared/ui/Panel';

type Screen = 'lobby' | 'spirits' | 'chat' | 'story' | 'memory' | 'storage' | 'settings' | 'guide';

export default function App() {
  const {width} = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>('lobby');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NativeSettings>({language: 'ko', model_name: null});
  const [spirits, setSpirits] = useState<SpiritSummary[]>([]);
  const [selected, setSelected] = useState<SpiritSummary | null>(null);
  const [detail, setDetail] = useState<SpiritDetail | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const label = labels(settings.language);

  useEffect(() => {
    let active = true;
    Promise.all([readSettings(), nativeApi().listSpirits(), nativeApi().listModels()])
      .then(([saved, spiritList, modelList]) => {
        if (!active) return;
        setSettings(saved);
        setSpirits(spiritList);
        setModels(modelList);
      })
      .catch(reason => { if (active) setError(String(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function selectSpirit(spirit: SpiritSummary) {
    setBusy(true);
    setError(null);
    try {
      const full = JSON.parse(await nativeApi().readSpirit(spirit.archive_key)) as SpiritDetail;
      const knownRooms = await roomsForSpirit(spirit.id);
      const latest = knownRooms[0] ?? null;
      const knownMessages = latest === null ? [] : await messagesForRoom(latest.id);
      setSelected(spirit);
      setDetail(full);
      setRooms(knownRooms);
      setRoom(latest);
      setMessages(knownMessages);
      setScreen('chat');
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function changeLanguage(language: Language) {
    const next = {...settings, language};
    try {
      await saveSettings(next);
      setSettings(next);
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function pickModel() {
    setBusy(true);
    setError(null);
    try {
      const imported = await nativeApi().pickModel();
      if (imported !== null) {
        await nativeApi().unloadModel();
        const next = {...settings, model_name: imported};
        await saveSettings(next);
        setSettings(next);
        setModels(await nativeApi().listModels());
        setModelLoaded(false);
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function selectModel(name: string) {
    const next = {...settings, model_name: name};
    try {
      await nativeApi().unloadModel();
      await saveSettings(next);
      setSettings(next);
      setModelLoaded(false);
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function loadModel() {
    if (!settings.model_name) return;
    setBusy(true);
    setModelLoaded(false);
    setError(null);
    try {
      await nativeApi().loadModel(settings.model_name, 4096);
      setModelLoaded(true);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteModel(name: string) {
    Alert.alert(label.deleteModel, label.confirmDeleteModel, [
      {text: label.cancel, style: 'cancel'},
      {text: label.deleteModel, style: 'destructive', onPress: () => void deleteModel(name)},
    ]);
  }

  async function deleteModel(name: string) {
    setBusy(true);
    setError(null);
    try {
      if (settings.model_name === name) {
        await nativeApi().unloadModel();
        setModelLoaded(false);
      }
      await nativeApi().deleteModel(name);
      setModels(await nativeApi().listModels());
      if (settings.model_name === name) {
        const next = {...settings, model_name: null};
        await saveSettings(next);
        setSettings(next);
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function startNewRoom() {
    if (selected === null) return;
    try {
      const created = await createRoom(selected.id);
      setRooms(previous => [created, ...previous]);
      setRoom(created);
      setMessages([]);
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function selectRoom(next: ChatRoom) {
    try {
      setMessages(await messagesForRoom(next.id));
      setRoom(next);
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function submit() {
    if (selected === null || detail === null || !modelLoaded || busy || !input.trim()) return;
    setBusy(true);
    setError(null);
    const text = input;
    setInput('');
    let currentRoom = room;
    try {
      if (currentRoom === null) {
        const created = await createRoom(selected.id);
        currentRoom = created;
        setRoom(created);
        setRooms(previous => [created, ...previous]);
      }
      const result = await sendMessage(currentRoom, detail, settings.language, text);
      setMessages(previous => [...previous, result.user, result.assistant]);
      setRooms(await roomsForSpirit(selected.id));
    } catch (reason) {
      setError(String(reason));
      if (currentRoom !== null) {
        try {
          setMessages(await messagesForRoom(currentRoom.id));
        } catch (readError) {
          setError(`${String(reason)}\n${String(readError)}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const nav: Array<{key: Screen; title: string}> = [
    {key: 'lobby', title: label.lobby},
    {key: 'spirits', title: label.spirits},
    {key: 'chat', title: label.chat},
    {key: 'settings', title: label.settings},
  ];

  function screenTitle(): string {
    if (screen === 'story') return label.story;
    if (screen === 'memory') return label.memory;
    if (screen === 'storage') return label.storage;
    if (screen === 'guide') return label.guide;
    return label.app;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar backgroundColor={colors.background} barStyle="light-content" />
      <View style={[styles.frame, {maxWidth: Math.min(width, 680)}]}>
        <View style={styles.header}>
          {screen === 'story' || screen === 'memory' || screen === 'storage' || screen === 'guide' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={label.lobby} onPress={() => setScreen('lobby')} style={styles.back}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
          <Text style={styles.headerTitle}>{screenTitle()}</Text>
        </View>
        {error ? (
          <Pressable accessibilityRole="button" onPress={() => setError(null)} style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </Pressable>
        ) : null}
        <View style={styles.content}>
          {loading ? <Text style={styles.empty}>{label.loading}</Text> : null}
          {!loading && screen === 'lobby' ? (
            <ScrollView contentContainerStyle={styles.lobby}>
              <Text style={styles.eyebrow}>EVER SOUL · MOBILE</Text>
              <Text style={styles.hero}>{selected ? localizedName(selected, detail, settings.language) : label.app}</Text>
              <Text style={styles.heroDetail}>{detail ? localizedGreeting(detail, settings.language) : label.noSpirit}</Text>
              <ActionButton label={selected ? label.chat : label.spirits} onPress={() => setScreen(selected ? 'chat' : 'spirits')} />
              <Panel title={label.readiness}>
                <Text style={styles.panelText}>{label.data}: {spirits.length}</Text>
                <Text style={styles.panelText}>{label.model}: {modelLoaded ? label.modelReady : label.modelMissing}</Text>
              </Panel>
              {detail ? (
                <Panel title={label.profile}>
                  <Text style={styles.panelText}>{localizedDescription(detail, settings.language)}</Text>
                  <Text style={styles.panelMuted}>{detail.race} · {detail.class}</Text>
                </Panel>
              ) : null}
              <View style={styles.quickActions}>
                <ActionButton label={label.story} kind="secondary" onPress={() => setScreen('story')} />
                <ActionButton label={label.memory} kind="secondary" onPress={() => setScreen('memory')} />
                <ActionButton label={label.storage} kind="secondary" onPress={() => setScreen('storage')} />
              </View>
            </ScrollView>
          ) : null}
          {!loading && screen === 'spirits' ? <SpiritRoster spirits={spirits} language={settings.language} onSelect={spirit => void selectSpirit(spirit)} /> : null}
          {!loading && screen === 'chat' ? (
            <ChatView spirit={selected} language={settings.language} rooms={rooms} activeRoom={room} messages={messages}
              input={input} busy={busy} modelLoaded={modelLoaded} onInput={setInput}
              onSend={() => void submit()} onCancel={() => nativeApi().cancelGeneration()}
              onNewRoom={() => void startNewRoom()} onSelectRoom={next => void selectRoom(next)} />
          ) : null}
          {!loading && screen === 'story' ? <StoryView detail={detail} language={settings.language} /> : null}
          {!loading && screen === 'memory' ? <MemoryView spirit={selected} language={settings.language} /> : null}
          {!loading && screen === 'storage' ? <StorageView language={settings.language} /> : null}
          {!loading && screen === 'guide' ? <GuideView language={settings.language} /> : null}
          {!loading && screen === 'settings' ? (
            <SettingsView settings={settings} models={models} modelLoaded={modelLoaded} busy={busy}
              onLanguage={language => void changeLanguage(language)} onPickModel={() => void pickModel()}
              onSelectModel={name => void selectModel(name)} onLoadModel={() => void loadModel()}
              onDeleteModel={confirmDeleteModel}
              onOpenStorage={() => setScreen('storage')} onOpenGuide={() => setScreen('guide')} />
          ) : null}
        </View>
        <View style={styles.nav}>
          {nav.map(item => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{selected: screen === item.key}}
              onPress={() => setScreen(item.key)}
              style={[styles.navItem, screen === item.key && styles.navActive]}>
              <Text style={[styles.navLabel, screen === item.key && styles.navLabelActive]}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  frame: {flex: 1, width: '100%', alignSelf: 'center', paddingHorizontal: 14},
  header: {minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8},
  headerTitle: {color: colors.text, fontSize: 19, fontWeight: '800'},
  back: {width: 40, height: 48, justifyContent: 'center'},
  backText: {color: colors.accent, fontSize: 32},
  content: {flex: 1},
  error: {backgroundColor: '#562d3f', borderRadius: 12, padding: 12, marginBottom: 8},
  errorText: {color: colors.danger, fontSize: 13},
  empty: {color: colors.muted, textAlign: 'center', padding: 30},
  lobby: {gap: 16, paddingBottom: 24},
  eyebrow: {color: colors.rose, fontSize: 12, fontWeight: '700', letterSpacing: 2},
  hero: {color: colors.text, fontSize: 36, fontWeight: '800'},
  heroDetail: {color: colors.muted, fontSize: 15, lineHeight: 23},
  panelText: {color: colors.text, lineHeight: 22},
  panelMuted: {color: colors.muted},
  quickActions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  nav: {minHeight: 62, flexDirection: 'row', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line},
  navItem: {flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  navActive: {backgroundColor: colors.surfaceRaised},
  navLabel: {color: colors.muted, fontSize: 13, fontWeight: '600'},
  navLabelActive: {color: colors.accent},
});
