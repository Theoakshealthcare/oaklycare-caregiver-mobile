import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Icon from "@/src/components/ui/icon";
import KeyboardInsetView from "@/src/components/ui/keyboard-inset-view";
import { Header } from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { MAX_FONT_SCALE, theme } from "@/src/constants/theme";
import { MAX_MESSAGE_LENGTH } from "@/src/domain/chat";
import { formatTime } from "@/src/domain/format";
import { useBooking } from "@/src/hooks/useBookings";
import { useChat, useSendMessage } from "@/src/hooks/useChat";
import { useMe } from "@/src/hooks/queries";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "Chat">;

/** Text chat with the caregiver on a booking. No call, video or voice-note buttons in v1. */
const Chat: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const booking = useBooking(id);
  const me = useMe();
  const chat = useChat(id);
  const send = useSendMessage(id);
  const [text, setText] = useState("");
  const list = useRef<ScrollView>(null);

  const submit = () => {
    const message = text.trim();
    if (!message || send.isPending) return;
    setText("");
    send.mutate(message, {
      // The message did not go: give the words back (unless the person has started typing something else).
      onError: () => setText((current) => (current ? current : message)),
    });
  };

  const myId = me.data?.id;
  const messages = (chat.data ?? []).filter((m) => m.text.trim() !== "");
  return (
    <KeyboardInsetView style={styles.screen}>
      <Header title={booking.data?.caregiver?.firstName ?? "Chat"} />
      <ScrollView
        ref={list}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      >
        {chat.isLoading ? <Text color={theme.colors.textLight}>Loading messages…</Text> : null}
        {chat.isError && !chat.data ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Text>{messageForError(chat.error)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={() => void chat.refetch()}>
              <Text weight="bold" color={theme.colors.primary}>
                Try again
              </Text>
            </Pressable>
          </View>
        ) : null}
        {chat.data && messages.length === 0 ? (
          <Text color={theme.colors.textLight} center>
            No messages yet. Say hello to your caregiver.
          </Text>
        ) : null}
        {messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text color={mine ? theme.colors.white : theme.colors.text}>{m.text}</Text>
              <Text variant="small" color={mine ? theme.colors.primaryLight : theme.colors.textLight}>
                {formatTime(m.sentAt)}
              </Text>
            </View>
          );
        })}
        {send.isPending ? (
          <View style={[styles.bubble, styles.mine, styles.sending]}>
            <Text color={theme.colors.white}>{send.variables}</Text>
            <Text variant="small" color={theme.colors.primaryLight}>
              Sending…
            </Text>
          </View>
        ) : null}
      </ScrollView>
      {send.isError ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text variant="small">{`Your message was not sent. ${messageForError(send.error)}`}</Text>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Message"
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.textLight}
          value={text}
          onChangeText={setText}
          maxLength={MAX_MESSAGE_LENGTH}
          multiline
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: send.isPending }}
          onPress={submit}
          style={[styles.send, send.isPending && styles.sending]}
        >
          <Icon name="send" size={18} color={theme.colors.white} />
        </Pressable>
      </View>
    </KeyboardInsetView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  messages: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  bubble: { maxWidth: "80%", borderRadius: theme.borderRadius.xl, padding: theme.spacing.sm + 4, gap: theme.spacing.xs },
  mine: { alignSelf: "flex-end", backgroundColor: theme.colors.primary },
  theirs: { alignSelf: "flex-start", backgroundColor: theme.colors.primaryLight },
  sending: { opacity: 0.6 },
  notice: { marginHorizontal: theme.spacing.lg, padding: theme.spacing.sm + 2, gap: theme.spacing.xs, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.secondaryLight },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm, padding: theme.spacing.md },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xxl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.sizes.body,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default Chat;
