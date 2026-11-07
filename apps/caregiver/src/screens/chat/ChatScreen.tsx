"use client"

import type React from "react"
import { useState, useRef } from "react"
import { View, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native"
import type { StackScreenProps } from "@react-navigation/stack"
import { Feather } from "@expo/vector-icons"

import { theme, MAX_FONT_SCALE } from "@/src/constants/theme"
import KeyboardInsetView from "@/src/components/ui/keyboard-inset-view"
import Text from "@/src/components/ui/text"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import { useChatMessages, useMe, useSendChatMessage } from "@/src/hooks/queries"
import { messageForError } from "@/src/api/errors"
import { CALLING_ENABLED } from "@/src/config/calling"
import { formatClock } from "@/src/utils/dates"
import type { ChatMessage } from "@/src/services/booking.service"
import type { ScreenParamLists } from "@/src/navigation/Navigations"

const ChatScreen: React.FC<StackScreenProps<ScreenParamLists, "ChatScreen">> = ({ route }) => {
  const { navigation } = Navigation()
  const { bookingId, patientName } = route.params
  const { data: me } = useMe()
  const { data: messages = [] } = useChatMessages(bookingId)
  const send = useSendChatMessage(bookingId)

  const [newMessage, setNewMessage] = useState("")
  const scrollViewRef = useRef<ScrollView>(null)

  const handleSendMessage = () => {
    const text = newMessage.trim()
    if (!text) return
    send.mutate(text, {
      onSuccess: () => setNewMessage(""),
      onError: (error) => Alert.alert("Message not sent", messageForError(error)),
    })
  }

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
          alignSelf: isMyMessage ? "flex-end" : "flex-start",
          backgroundColor: isMyMessage ? theme.colors.primary : theme.colors.white,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 20,
          marginBottom: 8,
          maxWidth: "80%",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <Text variant="body" color={isMyMessage ? theme.colors.white : theme.colors.text}>
          {message.message}
        </Text>
        <Text
          variant="small"
          color={isMyMessage ? theme.colors.white + "80" : theme.colors.textLight}
          style={{ marginTop: 4, alignSelf: "flex-end" }}
        >
          {formatClock(message.created_at)}
        </Text>
      </View>
    )
  }

  return (
    <KeyboardInsetView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: theme.colors.white,
            paddingTop: 50,
            paddingBottom: 16,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <View style={[globalStyles.row, { justifyContent: "space-between", alignItems: "center" }]}>
            <View style={[globalStyles.row, { alignItems: "center", flex: 1 }]}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
                <Feather name="arrow-left" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text variant="h3" weight="bold">
                  {patientName ?? "Patient"}
                </Text>
                <View style={[globalStyles.row, { alignItems: "center" }]}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.colors.success,
                      marginRight: 6,
                    }}
                  />
                  <Text variant="small" color={theme.colors.textLight}>
                    Messages refresh every few seconds
                  </Text>
                </View>
              </View>
            </View>
            {CALLING_ENABLED ? (
              <View style={[globalStyles.row, { gap: 16 }]}>
                <TouchableOpacity testID="chat-call" onPress={handleCall}>
                  <Feather name="phone" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity testID="chat-video-call" onPress={handleVideoCall}>
                  <Feather name="video" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            ) : null}
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
          {messages.map(renderMessage)}
        </ScrollView>

        {/* Message Input */}
        <View
          style={{
            backgroundColor: theme.colors.white,
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <View style={[globalStyles.row, { alignItems: "flex-end", gap: 12 }]}>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.background,
                borderRadius: 25,
                paddingHorizontal: 16,
                paddingVertical: 12,
                maxHeight: 100,
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
                  fontSize: theme.sizes.body,
                  color: theme.colors.text,
                  maxHeight: 80,
                }}
              />
            </View>
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || send.isPending}
              style={{
                backgroundColor: newMessage.trim() ? theme.colors.primary : theme.colors.border,
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="send" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardInsetView>
  )
}

export default ChatScreen
