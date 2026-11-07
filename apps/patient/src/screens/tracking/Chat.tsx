import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import Icon from "@/src/components/ui/icon";
import KeyboardInsetView from "@/src/components/ui/keyboard-inset-view";
import SampleNotice from "@/src/components/ui/sample-notice";
import { Header } from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { MAX_FONT_SCALE, theme } from "@/src/constants/theme";
import { formatTime } from "@/src/domain/format";
import { useBooking, useChat, useSendMessage } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "Chat">;

/** Text chat with the caregiver on a booking. No call, video or voice-note buttons in v1. */
const Chat: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const booking = useBooking(id);
  const chat = useChat(id);
  const send = useSendMessage(id);
  const [text, setText] = useState("");

  const submit = () => {
    const message = text.trim();
    if (!message) return;
    setText("");
    send.mutate(message);
  };

  return (
    <KeyboardInsetView style={styles.screen}>
      <Header title={booking.data?.caregiver?.name ?? "Chat"} />
      <ScrollView contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
        <SampleNotice what="This chat" />
        {(chat.data ?? []).map((m) => (
          <View key={m.id} style={[styles.bubble, m.from === "me" ? styles.mine : styles.theirs]}>
            <Text color={m.from === "me" ? theme.colors.white : theme.colors.text}>{m.text}</Text>
            <Text variant="small" color={m.from === "me" ? theme.colors.primaryLight : theme.colors.textLight}>
              {formatTime(m.sentAt)}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Message"
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.textLight}
          value={text}
          onChangeText={setText}
          multiline
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={submit} style={styles.send}>
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
