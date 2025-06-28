"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native"
import { Feather } from "@expo/vector-icons"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import { useWebSocket } from "@/src/hooks/use-websocket"
import bookingService from "@/src/services/booking.service"
import type { ChatScreenProps, ChatMessage } from "@/src/types/booking.types"

const ChatScreen: React.FC<ChatScreenProps> = ({ route }) => {
  const { navigation } = Navigation()
  const { booking } = route?.params || {}
  const { messages: wsMessages, sendChatMessage, joinBooking, leaveBooking, isConnected } = useWebSocket()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (booking?.id) {
      loadChatMessages()
      joinBooking(booking.id)

      return () => {
        leaveBooking(booking.id)
      }
    }
  }, [booking?.id])

  useEffect(() => {
    // Handle real-time messages
    const chatMessages = wsMessages.filter((msg) => msg.type === "chat_message" && msg.booking_id === booking?.id)

    if (chatMessages.length > 0) {
      const latestMessage = chatMessages[chatMessages.length - 1]
      const newChatMessage: ChatMessage = {
        id: Date.now().toString(),
        booking_id: latestMessage.booking_id!,
        sender_id: latestMessage.sender_id!,
        message: latestMessage.message!,
        message_type: "text",
        is_read: false,
        created_at: latestMessage.timestamp!,
      }

      setMessages((prev) => {
        // Avoid duplicates
        if (
          !prev.find((msg) => msg.message === newChatMessage.message && msg.created_at === newChatMessage.created_at)
        ) {
          return [...prev, newChatMessage]
        }
        return prev
      })
    }
  }, [wsMessages, booking?.id])

  const loadChatMessages = async () => {
    if (!booking?.id) return

    try {
      setIsLoading(true)
      const data = await bookingService.getChatMessages(booking.id)
      setMessages(data)
    } catch (error) {
      console.error("Failed to load chat messages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !booking?.id) return

    const messageText = newMessage.trim()
    setNewMessage("")

    try {
      // Send via WebSocket for real-time delivery
      sendChatMessage(booking.id, messageText)

      // Also save to database
      await bookingService.sendChatMessage(booking.id, messageText)
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  const handleCall = () => {
    navigation.navigate("CallScreen", { booking })
  }

  const handleVideoCall = () => {
    navigation.navigate("CallScreen", { booking, isVideo: true })
  }

  const renderMessage = (message: ChatMessage, index: number) => {
    const isMyMessage = message.sender_id === "current_user_id" // Replace with actual current user ID
    const isLastMessage = index === messages.length - 1

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
          {new Date(message.created_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    )
  }

  if (!booking) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <Text variant="body">Booking not found</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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
                  {booking.patient?.full_name || "Patient"}
                </Text>
                <View style={[globalStyles.row, { alignItems: "center" }]}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isConnected ? theme.colors.success : theme.colors.textLight,
                      marginRight: 6,
                    }}
                  />
                  <Text variant="small" color={theme.colors.textLight}>
                    {isConnected ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[globalStyles.row, { gap: 16 }]}>
              <TouchableOpacity onPress={handleCall}>
                <Feather name="phone" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleVideoCall}>
                <Feather name="video" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingVertical: 20 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
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
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.textLight}
                multiline
                style={{
                  fontSize: 16,
                  color: theme.colors.text,
                  maxHeight: 80,
                }}
              />
            </View>
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!newMessage.trim()}
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
    </KeyboardAvoidingView>
  )
}

export default ChatScreen
