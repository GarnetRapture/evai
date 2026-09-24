import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {Language, NativeSettings} from '../../../shared/native';
import {colors} from '../../../shared/theme';
import {ActionButton} from '../../../shared/ui/ActionButton';
import {Panel} from '../../../shared/ui/Panel';
import {labels} from '../labels';

interface SettingsViewProps {
  settings: NativeSettings;
  models: string[];
  modelLoaded: boolean;
  busy: boolean;
  onLanguage: (language: Language) => void;
  onPickModel: () => void;
  onSelectModel: (name: string) => void;
  onLoadModel: () => void;
  onDeleteModel: (name: string) => void;
  onOpenStorage: () => void;
  onOpenGuide: () => void;
}

const languages: Array<{key: Language; name: string}> = [
  {key: 'ko', name: '한국어'}, {key: 'en', name: 'English'}, {key: 'zh_cn', name: '简体中文'},
];

export function SettingsView(props: SettingsViewProps) {
  const label = labels(props.settings.language);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Panel title={label.language}>
        <View style={styles.row}>
          {languages.map(language => (
            <Pressable
              key={language.key}
              accessibilityRole="button"
              accessibilityState={{selected: props.settings.language === language.key}}
              onPress={() => props.onLanguage(language.key)}
              style={[styles.choice, props.settings.language === language.key && styles.selected]}>
              <Text style={styles.choiceText}>{language.name}</Text>
            </Pressable>
          ))}
        </View>
      </Panel>
      <Panel title={label.model}>
        <Text style={styles.note}>{props.modelLoaded ? label.modelReady : label.modelMissing}</Text>
        {props.models.map(name => (
          <View key={name} style={styles.modelRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{selected: name === props.settings.model_name}}
              onPress={() => props.onSelectModel(name)}
              style={[styles.model, name === props.settings.model_name && styles.selected]}>
              <Text style={styles.modelText}>{name}</Text>
            </Pressable>
            <ActionButton label={label.deleteModel} kind="danger" onPress={() => props.onDeleteModel(name)} disabled={props.busy} />
          </View>
        ))}
        <View style={styles.actions}>
          <ActionButton label={label.importModel} onPress={props.onPickModel} disabled={props.busy} kind="secondary" />
          <ActionButton label={label.loadModel} onPress={props.onLoadModel} disabled={props.busy || !props.settings.model_name} />
        </View>
      </Panel>
      <Panel title={label.storage}>
        <ActionButton label={label.storage} onPress={props.onOpenStorage} kind="secondary" />
      </Panel>
      <Panel title={label.guide}>
        <ActionButton label={label.guide} onPress={props.onOpenGuide} kind="secondary" />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {gap: 14, paddingBottom: 24},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  choice: {minHeight: 48, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surfaceRaised},
  selected: {borderWidth: 1, borderColor: colors.accent},
  choiceText: {color: colors.text, fontWeight: '600'},
  note: {color: colors.muted},
  model: {flex: 1, padding: 12, backgroundColor: colors.surfaceRaised, borderRadius: 12, minHeight: 48, justifyContent: 'center'},
  modelRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  modelText: {color: colors.text},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
});
