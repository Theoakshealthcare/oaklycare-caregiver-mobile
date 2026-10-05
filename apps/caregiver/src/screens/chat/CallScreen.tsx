"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, TouchableOpacity, Alert } from "react-native"
import { Feather } from "@expo/vector-icons"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import type { CallScreenProps } from "@/src/types/booking.types"

const CallScreen: React.FC<CallScreenProps> = ({ route }) => {
  const { navigation } = Navigation()
  const { booking, isVideo = false } = route?.params || {}

  const [isCallActive, setIsCallActive] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideo)

  useEffect(() => {
    // Start call timer when call becomes active
    let interval: ReturnType<typeof setInterval> | undefined
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isCallActive])

  useEffect(() => {
    // Simulate call connection after 2 seconds
    const timer = setTimeout(() => {
      setIsCallActive(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleEndCall = () => {
    Alert.alert("End Call", "Are you sure you want to end this call?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Call",
        style: "destructive",
        onPress: () => {
          navigation.goBack()
        },
      },
    ])
  }

  const handleToggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleToggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn)
  }

  const handleToggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled)
  }

  const handleOpenNotes = () => {
    navigation.navigate("AINoteTaker", { booking })
  }

  if (!booking) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <Text variant="body">Booking not found</Text>
      </View>
    )
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.primary,
        justifyContent: "space-between",
        paddingVertical: 50,
        paddingHorizontal: 20,
      }}
    >
      {/* Call Info */}
      <View style={{ alignItems: "center", marginTop: 50 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: theme.colors.white + "20",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Feather name="user" size={60} color={theme.colors.white} />
        </View>

        <Text variant="h2" weight="bold" color={theme.colors.white} style={{ marginBottom: 8 }}>
          {booking.patient?.full_name || "Patient"}
        </Text>

        <Text variant="body" color={theme.colors.white + "80"} style={{ marginBottom: 16 }}>
          {isVideo ? "Video Call" : "Voice Call"}
        </Text>

        {isCallActive ? (
          <View
            style={{
              backgroundColor: theme.colors.white + "20",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
            }}
          >
            <Text variant="body" color={theme.colors.white} weight="medium">
              {formatDuration(callDuration)}
            </Text>
          </View>
        ) : (
          <Text variant="body" color={theme.colors.white + "80"}>
            Connecting...
          </Text>
        )}
      </View>

      {/* Call Controls */}
      <View>
        {/* Secondary Controls */}
        <View style={[globalStyles.row, { justifyContent: "center", marginBottom: 30, gap: 30 }]}>
          <TouchableOpacity
            onPress={handleToggleMute}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: isMuted ? theme.colors.error : theme.colors.white + "20",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name={isMuted ? "mic-off" : "mic"} size={24} color={theme.colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleSpeaker}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: isSpeakerOn ? theme.colors.white + "40" : theme.colors.white + "20",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="volume-2" size={24} color={theme.colors.white} />
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity
              onPress={handleToggleVideo}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isVideoEnabled ? theme.colors.white + "40" : theme.colors.error,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name={isVideoEnabled ? "video" : "video-off"} size={24} color={theme.colors.white} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleOpenNotes}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: theme.colors.white + "20",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="edit-3" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        {/* Primary Controls */}
        <View style={[globalStyles.row, { justifyContent: "center", gap: 50 }]}>
          <TouchableOpacity
            onPress={handleEndCall}
            style={{
              width: 70,
              height: 70,
              borderRadius: 35,
              backgroundColor: theme.colors.error,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="phone-off" size={28} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default CallScreen
