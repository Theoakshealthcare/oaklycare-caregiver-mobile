"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, TouchableOpacity, Alert, TextInput, Linking } from "react-native"
import { Feather } from "@expo/vector-icons"
import type { StackScreenProps } from "@react-navigation/stack"
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio"

import { theme, MAX_FONT_SCALE } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import { messageForError } from "@/src/api/errors"
import { formatStamp } from "@/src/utils/dates"
import { useCreateNote, useNotes } from "@/src/hooks/queries"
import type { BookingNote } from "@/src/services/booking.service"
import type { ScreenParamLists } from "@/src/navigation/Navigations"

const AINoteTaker: React.FC<StackScreenProps<ScreenParamLists, "AINoteTaker">> = ({ route }) => {
  const { bookingId } = route.params

  const [isRecording, setIsRecording] = useState(false)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const { data: notes = [] } = useNotes(bookingId)
  const createNote = useCreateNote(bookingId)
  const [currentNote, setCurrentNote] = useState("")
  const [noteTitle, setNoteTitle] = useState("")
  const [recordingDuration, setRecordingDuration] = useState(0)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    } else {
      setRecordingDuration(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  const startRecording = async () => {
    try {
      // The microphone is asked for only now, when the caregiver taps the mic, never on opening the screen (DP1-17).
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(
          "Microphone is off",
          "Allow the microphone for Oakly in Settings to record. You can still type your note.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        )
        return
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setIsRecording(true)
    } catch (error) {
      console.error("Failed to start recording:", error)
      Alert.alert("Error", "Failed to start recording")
    }
  }

  const stopRecording = async () => {
    if (!isRecording) return

    try {
      setIsRecording(false)
      await recorder.stop()

      // There is no audio upload or transcription endpoint yet, so a recording is not saved and no
      // transcript is invented. The caregiver writes the note by hand.
      Alert.alert("Recording stopped", "Voice transcription isn't available yet. Please type your note below.")
    } catch (error) {
      console.error("Failed to stop recording:", error)
      Alert.alert("Error", "Failed to stop recording")
    }
  }

  const saveTextNote = () => {
    if (!noteTitle.trim() || !currentNote.trim()) {
      Alert.alert("Error", "Please enter both title and note content")
      return
    }
    createNote.mutate(
      { title: noteTitle.trim(), content: currentNote.trim() },
      {
        onSuccess: () => {
          setNoteTitle("")
          setCurrentNote("")
          Alert.alert("Success", "Note saved!")
        },
        onError: (error) => Alert.alert("Error", messageForError(error)),
      },
    )
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const renderNote = (note: BookingNote) => (
    <View
      key={note.id}
      style={{
        backgroundColor: theme.colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <Text variant="h3" weight="bold" style={{ marginBottom: 8 }}>
        {note.title}
      </Text>

      {note.content && (
        <View style={{ marginBottom: 12 }}>
          <Text variant="body" style={{ lineHeight: 22 }}>
            {note.content}
          </Text>
        </View>
      )}

      {note.ai_summary && (
        <View
          style={{
            backgroundColor: theme.colors.primaryLight,
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <Text variant="small" color={theme.colors.primary} weight="bold" style={{ marginBottom: 4 }}>
            AI Summary
          </Text>
          <Text variant="body" color={theme.colors.primary}>
            {note.ai_summary}
          </Text>
        </View>
      )}

      {note.ai_recommendations && (
        <View
          style={{
            backgroundColor: theme.colors.successLight,
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <Text variant="small" color={theme.colors.success} weight="bold" style={{ marginBottom: 4 }}>
            AI Recommendations
          </Text>
          <Text variant="body" color={theme.colors.success}>
            {note.ai_recommendations}
          </Text>
        </View>
      )}

      {note.ai_keywords && note.ai_keywords.length > 0 && (
        <View style={[globalStyles.row, { flexWrap: "wrap", gap: 8 }]}>
          {note.ai_keywords.map((keyword, index) => (
            <View
              key={index}
              style={{
                backgroundColor: theme.colors.background,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text variant="small" color={theme.colors.textLight}>
                {keyword}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 8 }}>
        {formatStamp(note.created_at)}
      </Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <KeyboardScrollView>
        <View style={globalStyles.container}>
          <HeaderBack />

          <View style={{ marginVertical: "5%" }}>
            <Text variant="h2" weight="bold">
              AI Note Taker
            </Text>
            <Text variant="body" color={theme.colors.textLight}>
              Write notes for this visit. Voice recordings are not transcribed yet.
            </Text>
          </View>

          {/* Note Input */}
          <View
            style={{
              backgroundColor: theme.colors.white,
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <TextInput
 maxFontSizeMultiplier={MAX_FONT_SCALE}
              placeholder="Note title..."
              value={noteTitle}
              onChangeText={setNoteTitle}
              style={{
                fontSize: theme.sizes.subtitle,
                fontWeight: "bold",
                color: theme.colors.text,
                marginBottom: 12,
              }}
            />

            <TextInput
 maxFontSizeMultiplier={MAX_FONT_SCALE}
              placeholder="Write your observations here..."
              value={currentNote}
              onChangeText={setCurrentNote}
              multiline
              numberOfLines={4}
              style={{
                fontSize: theme.sizes.body,
                color: theme.colors.text,
                textAlignVertical: "top",
                marginBottom: 16,
              }}
            />

            {/* Recording Controls */}
            <View style={[globalStyles.row, { justifyContent: "center", marginBottom: 16 }]}>
              <TouchableOpacity
                testID="mic-button"
                accessibilityRole="button"
                accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
                onPress={isRecording ? stopRecording : startRecording}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: isRecording ? theme.colors.error : theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 20,
                }}
              >
                <Feather name={isRecording ? "square" : "mic"} size={32} color={theme.colors.white} />
              </TouchableOpacity>

            </View>

            {isRecording && (
              <View
                testID="recording-indicator"
                accessibilityRole="alert"
                style={[globalStyles.row, { justifyContent: "center", marginBottom: 16, backgroundColor: theme.colors.secondaryLight, padding: 12, borderRadius: 12 }]}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.error }} />
                <Text variant="body" color={theme.colors.error} weight="bold" testID="recording-timer">
                  {`Recording ${formatDuration(recordingDuration)}`}
                </Text>
                <Text variant="small" color={theme.colors.textLight}>
                  Tap the square to stop
                </Text>
              </View>
            )}

            <Button title="Save Note" onPress={saveTextNote} loading={createNote.isPending} />
          </View>

          {/* Previous Notes */}
          <View>
            <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
              Previous Notes ({notes.length})
            </Text>
            {notes.length === 0 ? (
              <Text variant="body" color={theme.colors.textLight} testID="notes-empty">
                No notes for this visit yet. Notes you save appear here.
              </Text>
            ) : (
              notes.map(renderNote)
            )}
          </View>
        </View>
      </KeyboardScrollView>
    </View>
  )
}

export default AINoteTaker
