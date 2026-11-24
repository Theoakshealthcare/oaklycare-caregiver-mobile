import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useIsFocused } from "@react-navigation/native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Icon from "@/src/components/ui/icon";
import KeyboardInsetView from "@/src/components/ui/keyboard-inset-view";
import ProviderAvatar from "@/src/components/booking/ProviderAvatar";
import { useBottomBand, useTopBand } from "@/src/components/StatusBar/screenChrome";
import Text from "@/src/components/ui/text";
import { MAX_FONT_SCALE, theme } from "@/src/constants/theme";
import { sameDay, SHORT_WEEKDAYS } from "@/src/domain/bookingList";
import { MAX_MESSAGE_LENGTH } from "@/src/domain/chat";
import { formatTime } from "@/src/domain/format";
import { useBooking } from "@/src/hooks/useBookings";
import { useChat, useSendMessage } from "@/src/hooks/useChat";
import { useMe } from "@/src/hooks/queries";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "Chat">;

/** Text chat with the caregiver on a booking. No call, video or voice-note buttons in v1. */
const Chat: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const focused = useIsFocused();
  useTopBand(focused ? theme.colors.primary : null);
  // The message bar runs to the bottom edge, as in the design (no white strip under it).
  useBottomBand(focused ? theme.colors.primaryLight : null);
  const booking = useBooking(id);
  const caregiver = booking.data?.caregiver ?? null;
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
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-back" size={20} color={theme.colors.white} />
        </Pressable>
        <ProviderAvatar uri={caregiver?.photoUrl} name={caregiver?.firstName} size={44} radius={22} />
        <View style={styles.headerText}>
          <Text weight="bold" color={theme.colors.white} numberOfLines={1}>
            {caregiver?.firstName ?? "Chat"}
          </Text>
          {caregiver ? (
            <Text variant="small" color={theme.colors.white} numberOfLines={1}>
              {caregiver.role ?? "Health Care Provider"}
            </Text>
          ) : null}
        </View>
      </View>
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
        {messages.map((m, index) => {
          const mine = m.senderId === myId;
          const newDay = index === 0 || !sameDay(new Date(messages[index - 1].sentAt), new Date(m.sentAt));
          return (
            <View key={m.id} style={styles.item}>
              {newDay ? (
                <Text variant="small" color={theme.colors.textLight} center>
                  {`${SHORT_WEEKDAYS[new Date(m.sentAt).getDay()]} ${formatTime(m.sentAt)}`}
                </Text>
              ) : null}
              <View style={[styles.line, mine && styles.lineMine]}>
                {!mine ? <ProviderAvatar uri={caregiver?.photoUrl} name={caregiver?.firstName} size={30} radius={15} /> : null}
                <View style={styles.column}>
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text>{m.text}</Text>
                  </View>
                  <Text variant="fine" color={theme.colors.textLight} style={mine ? styles.timeMine : styles.time}>
                    {formatTime(m.sentAt)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
        {send.isPending ? (
          <View style={[styles.line, styles.lineMine]}>
            <View style={styles.column}>
              <View style={[styles.bubble, styles.mine, styles.sending]}>
                <Text>{send.variables}</Text>
              </View>
              <Text variant="fine" color={theme.colors.textLight} style={styles.timeMine}>
                Sending…
              </Text>
            </View>
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
  screen: { flex: 1, backgroundColor: theme.colors.pageTint },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm + 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.white, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  messages: { padding: theme.spacing.lg, gap: theme.spacing.md },
  item: { gap: theme.spacing.sm },
  line: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm, maxWidth: "88%" },
  lineMine: { alignSelf: "flex-end" },
  column: { flexShrink: 1, gap: 2 },
  bubble: { borderRadius: theme.borderRadius.xl, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm + 4 },
  // Figma: a pale grey bubble from the caregiver, a pale teal one from the family.
  mine: { backgroundColor: "#E4F6F5" },
  theirs: { backgroundColor: theme.colors.background },
  time: { alignSelf: "flex-start", marginLeft: 4 },
  timeMine: { alignSelf: "flex-end", marginRight: 4 },
  sending: { opacity: 0.6 },
  notice: { marginHorizontal: theme.spacing.lg, padding: theme.spacing.sm + 2, gap: theme.spacing.xs, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.secondaryLight },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.primaryLight },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.round,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.sizes.body,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default Chat;
