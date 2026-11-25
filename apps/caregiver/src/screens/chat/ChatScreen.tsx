"use client"

import type React from "react"
import { useState, useRef, useMemo } from "react"
import { View, ScrollView, TextInput, TouchableOpacity, Alert, Pressable } from "react-native"
import type { StackScreenProps } from "@react-navigation/stack"
import { Feather, Ionicons } from "@expo/vector-icons"
import { useQueryClient } from "@tanstack/react-query"
import { CHAT_CLOSED, chatWindow, errorCode } from "@oakly/api-client"

import { theme, MAX_FONT_SCALE } from "@/src/constants/theme"
import KeyboardInsetView from "@/src/components/ui/keyboard-inset-view"
import Text from "@/src/components/ui/text"
import PatientAvatar from "@/src/components/chat/PatientAvatar"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import { useBooking, useChatMessages, useMe, useSendChatMessage } from "@/src/hooks/queries"
import { ApiError, messageForError } from "@/src/api/errors"
import { queryKeys } from "@/src/api/keys"
import { formatUntil } from "@/src/utils/dates"
import { CALLING_ENABLED } from "@/src/config/calling"
import { voiceNotesMode } from "@/src/config/voiceNotes"
import BookingContextCard from "@/src/components/chat/BookingContextCard"
import { QUICK_REPLIES, bookingContext, withStamps } from "@/src/components/chat/chatModel"
import type { ChatMessage } from "@/src/services/booking.service"
import type { ScreenParamLists } from "@/src/navigation/Navigations"

const AVATAR = 40

/** The two calm lines a closed chat shows in place of the message bar. */
export const CHAT_CLOSED_VISIT_OVER = "This chat has closed because the visit is over."
export const CHAT_CLOSED_CANCELLED = "This chat is closed because the booking was cancelled."

const RoundIconButton: React.FC<{ icon: React.ComponentProps<typeof Feather>["name"]; label: string; onPress: () => void; testID: string }> = ({
  icon,
  label,
  onPress,
  testID,
}) => (
  <TouchableOpacity
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={{
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.7)",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Feather name={icon} size={18} color={theme.colors.white} />
  </TouchableOpacity>
)

const ChatScreen: React.FC<StackScreenProps<ScreenParamLists, "ChatScreen">> = ({ route }) => {
  const { navigation } = Navigation()
  const { bookingId, patientName, patientPhotoUrl } = route.params
  const { data: me } = useMe()
  const { data: messages = [] } = useChatMessages(bookingId)
  const { data: booking } = useBooking(bookingId)
  const send = useSendChatMessage(bookingId)

  const [newMessage, setNewMessage] = useState("")
  const scrollViewRef = useRef<ScrollView>(null)
  const client = useQueryClient()

  // The chat can be written to until 24 h after the visit is completed, never once the booking was cancelled. A missing
  // field counts as open; a send that comes back 409 `chat_closed` closes the screen (no error toast) because the
  // server has the last word.
  const [closedByServer, setClosedByServer] = useState(false)
  const gate = chatWindow(booking)
  const closed = closedByServer || !gate.open
  const closedText = !gate.open && gate.reason === "cancelled" ? CHAT_CLOSED_CANCELLED : CHAT_CLOSED_VISIT_OVER
  const hint = gate.open && !closedByServer && gate.closesAt ? `You can chat until ${formatUntil(gate.closesAt)}` : null

  const name = patientName ?? booking?.patient_details?.full_name ?? "Patient"
  const photo = patientPhotoUrl ?? booking?.patient_details?.profile_image_url ?? null
  const voiceOn = voiceNotesMode() !== "off"
  const rows = useMemo(() => withStamps(messages), [messages])
  const context = useMemo(() => (booking ? bookingContext(booking) : null), [booking])

  const deliver = (text: string, onSent?: () => void) => {
    send.mutate(text, {
      onSuccess: onSent,
      onError: (error) => {
        if (error instanceof ApiError && errorCode(error.body) === CHAT_CLOSED) {
          setClosedByServer(true)
          // The booking carries the reason and the time: read it again so the banner is right next time too.
          void client.invalidateQueries({ queryKey: queryKeys.booking(bookingId) })
          return
        }
        Alert.alert("Message not sent", messageForError(error))
      },
    })
  }

  const handleSendMessage = () => {
    const text = newMessage.trim()
    if (!text) return
    deliver(text, () => setNewMessage(""))
  }

  const openNotetaker = () => navigation.navigate("AINoteTaker", { bookingId })

  const handleCall = () => {
    navigation.navigate("CallScreen", { bookingId, patientName })
  }

  const handleVideoCall = () => {
    navigation.navigate("CallScreen", { bookingId, patientName, isVideo: true })
  }

  const renderMessage = (message: ChatMessage) => {
    const isMyMessage = message.sender_id === me?.id

    return (
      <View
        key={message.id}
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: theme.spacing.sm,
          alignSelf: isMyMessage ? "flex-end" : "flex-start",
          maxWidth: "88%",
          marginBottom: theme.spacing.sm,
        }}
      >
        {isMyMessage ? null : <PatientAvatar name={name} uri={photo} size={32} initialTestID="chat-avatar-initial" />}
        <View
          testID={isMyMessage ? "chat-bubble-mine" : "chat-bubble-theirs"}
          style={{
            flexShrink: 1,
            backgroundColor: isMyMessage ? theme.colors.bubbleSent : theme.colors.bubbleReceived,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 16,
          }}
        >
          <Text variant="small" color={theme.colors.text}>
            {message.message}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardInsetView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: theme.colors.careBackground }}>
        {/* Header */}
        <View
          testID="chat-header"
          style={{
            backgroundColor: theme.colors.primary,
            // Under the safe-area band already: Figma's back button sits about 20 pt below the status bar.
            paddingTop: 20,
            paddingBottom: 16,
            paddingHorizontal: 20,
          }}
        >
          <View style={[globalStyles.row, { justifyContent: "space-between", alignItems: "center" }]}>
            <View style={[globalStyles.row, { alignItems: "center", flex: 1 }]}>
              <TouchableOpacity
                testID="chat-back"
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => navigation.goBack()}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.7)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="chevron-left" size={20} color={theme.colors.white} />
              </TouchableOpacity>
              <PatientAvatar name={name} uri={photo} size={AVATAR} initialTestID="chat-avatar-initial" />
              <Text variant="body" weight="bold" color={theme.colors.white} style={{ flexShrink: 1 }} numberOfLines={1} testID="chat-name">
                {name}
              </Text>
            </View>
            <View style={[globalStyles.row, { gap: 12 }]}>
              {voiceOn ? <RoundIconButton testID="chat-notetaker" icon="mic" label="AI Notetaker" onPress={openNotetaker} /> : null}
              {CALLING_ENABLED ? (
                <>
                  <TouchableOpacity testID="chat-call" onPress={handleCall}>
                    <Feather name="phone" size={24} color={theme.colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity testID="chat-video-call" onPress={handleVideoCall}>
                    <Feather name="video" size={24} color={theme.colors.white} />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingVertical: 20 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          // The list shrinks when the keyboard opens: keep the latest message in view.
          onLayout={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {context ? (
            <BookingContextCard context={context} onViewDetails={() => navigation.popTo("BookingDetails", { bookingId })} />
          ) : null}
          {rows.map((row) =>
            row.kind === "stamp" ? (
              <Text key={row.key} variant="label" color={theme.colors.textLight} center testID="chat-stamp" style={{ marginVertical: theme.spacing.sm }}>
                {row.label}
              </Text>
            ) : (
              renderMessage(row.message)
            ),
          )}
        </ScrollView>

        {closed ? (
          <View
            testID="chat-closed-banner"
            accessibilityRole="alert"
            style={{ backgroundColor: theme.colors.primaryLight, paddingHorizontal: 20, paddingVertical: theme.spacing.lg }}
          >
            <Text variant="small" center color={theme.colors.text}>
              {closedText}
            </Text>
          </View>
        ) : null}

        {/* Quick replies and message input: not drawn once the chat is closed */}
        {closed ? null : (
        <View
          style={{
            backgroundColor: theme.colors.primaryLight,
            paddingHorizontal: 20,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          {hint ? (
            <Text variant="label" center color={theme.colors.textLight} testID="chat-closes-hint">
              {hint}
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: theme.spacing.sm }}>
            {QUICK_REPLIES.map((reply) => (
              <Pressable
                key={reply}
                testID={`quick-reply-${reply}`}
                accessibilityRole="button"
                disabled={send.isPending}
                onPress={() => deliver(reply)}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.white,
                  borderRadius: theme.borderRadius.round,
                  paddingHorizontal: theme.spacing.sm + 4,
                  paddingVertical: 5,
                  opacity: send.isPending ? 0.5 : 1,
                }}
              >
                <Text variant="micro" color={theme.colors.text}>
                  {reply}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[globalStyles.row, { alignItems: "center", gap: 12 }]}>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: theme.colors.white,
                borderWidth: 1,
                borderColor: "rgba(22, 130, 131, 0.35)",
                borderRadius: 25,
                paddingLeft: 16,
                paddingRight: 12,
                paddingVertical: 4,
              }}
            >
              <TextInput
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.textLight}
                multiline
                style={{
                  flex: 1,
                  fontSize: theme.sizes.compact,
                  color: theme.colors.text,
                  maxHeight: 80,
                  paddingVertical: 8,
                }}
              />
              {voiceOn ? (
                <TouchableOpacity testID="chat-composer-mic" accessibilityRole="button" accessibilityLabel="Voice to text" onPress={openNotetaker} hitSlop={8}>
                  <Feather name="mic" size={20} color={theme.colors.textLight} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              testID="chat-send"
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || send.isPending}
              style={{
                backgroundColor: theme.colors.primary,
                opacity: newMessage.trim() && !send.isPending ? 1 : 0.7,
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="paper-plane-outline" size={22} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>
        )}
      </View>
    </KeyboardInsetView>
  )
}

export default ChatScreen
