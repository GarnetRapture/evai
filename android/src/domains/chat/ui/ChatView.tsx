import React, {useRef} from 'react';
import {FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import type {ChatMessage, ChatRoom, Language, SpiritSummary} from '../../../shared/native';
import {colors} from '../../../shared/theme';
import {ActionButton} from '../../../shared/ui/ActionButton';
import {labels} from '../../settings/labels';
import {displayReply} from '../service';

interface ChatViewProps {
  spirit: SpiritSummary | null;
  language: Language;
  rooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  messages: ChatMessage[];
  input: string;
  busy: boolean;
  modelLoaded: boolean;
  onInput: (text: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onNewRoom: () => void;
  onSelectRoom: (room: ChatRoom) => void;
}

export function ChatView(props: ChatViewProps) {
  const list = useRef<FlatList<ChatMessage>>(null);
  const label = labels(props.language);
  if (props.spirit === null) {
    return <Text style={styles.empty}>{label.noSpirit}</Text>;
  }
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{props.language === 'en' ? props.spirit.name_en : props.language === 'zh_cn' ? props.spirit.name_zh_cn ?? props.spirit.name : props.spirit.name}</Text>
          <Text style={styles.subtitle}>{props.modelLoaded ? label.modelReady : label.modelMissing}</Text>
        </View>
        <ActionButton label={label.newChat} kind="secondary" onPress={props.onNewRoom} />
      </View>
      {props.rooms.length > 1 ? (
        <FlatList
          horizontal
          data={props.rooms}
          keyExtractor={room => room.id}
          contentContainerStyle={styles.rooms}
          showsHorizontalScrollIndicator={false}
          renderItem={({item}) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => props.onSelectRoom(item)}
              style={[styles.room, item.id === props.activeRoom?.id && styles.activeRoom]}>
              <Text style={styles.roomText}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </Pressable>
          )}
        />
      ) : null}
      <FlatList
        ref={list}
        data={props.messages}
        keyExtractor={message => message.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => list.current?.scrollToEnd({animated: false})}
        ListEmptyComponent={<Text style={styles.empty}>{label.empty}</Text>}
        renderItem={({item}) => {
          const reply = item.role === 'assistant' ? displayReply(item.content) : null;
          return (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.spiritBubble]}>
              {reply?.thought ? <Text style={styles.thought}>{reply.thought}</Text> : null}
              {item.spirit_action ? <Text style={styles.action}>{item.spirit_action}</Text> : null}
              <Text style={styles.messageText}>{reply?.spoken ?? item.content}</Text>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={label.messageHint}
          placeholder={label.messageHint}
          placeholderTextColor={colors.muted}
          multiline
          value={props.input}
          onChangeText={props.onInput}
          style={styles.input}
        />
        {props.busy ? (
          <ActionButton label={label.cancel} kind="secondary" onPress={props.onCancel} />
        ) : (
          <ActionButton label={label.send} onPress={props.onSend} disabled={!props.modelLoaded || !props.input.trim()} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  heading: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10},
  headingCopy: {flex: 1},
  title: {color: colors.text, fontSize: 20, fontWeight: '700'},
  subtitle: {color: colors.muted, fontSize: 12, marginTop: 3},
  rooms: {gap: 8, paddingBottom: 12},
  room: {backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, minHeight: 44},
  activeRoom: {backgroundColor: colors.accentStrong},
  roomText: {color: colors.text, fontSize: 12},
  messages: {gap: 10, paddingVertical: 12, flexGrow: 1},
  bubble: {maxWidth: '84%', borderRadius: 20, padding: 14},
  userBubble: {alignSelf: 'flex-end', backgroundColor: colors.accentStrong, borderBottomRightRadius: 5},
  spiritBubble: {alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderBottomLeftRadius: 5},
  action: {color: colors.rose, fontStyle: 'italic', marginBottom: 8},
  thought: {color: colors.muted, fontStyle: 'italic', marginBottom: 8},
  messageText: {color: colors.text, fontSize: 15, lineHeight: 23},
  composer: {flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingVertical: 8},
  input: {
    flex: 1, minHeight: 48, maxHeight: 120, backgroundColor: colors.surface,
    borderColor: colors.line, borderWidth: 1, borderRadius: 16,
    color: colors.text, paddingHorizontal: 14, paddingVertical: 10,
  },
  empty: {color: colors.muted, textAlign: 'center', padding: 32},
});
