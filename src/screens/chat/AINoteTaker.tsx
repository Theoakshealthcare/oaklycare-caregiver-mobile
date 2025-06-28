"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, ScrollView, TouchableOpacity, Alert, TextInput } from "react-native"
import { Feather } from "@expo/vector-icons"
import { Audio } from "expo-av"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import bookingService from "@/src/services/booking.service"
import type { AINoteTakerProps, BookingNote } from "@/src/types/booking.types"

const AINoteTaker: React.FC<AINoteTakerProps> = ({ route }) => {
  const { navigation } = Navigation()
  const { booking } = route?.params || {}

  const [isRecording, setIsRecording] = useState(false)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [notes, setNotes] = useState<BookingNote[]>([])
  const [currentNote, setCurrentNote] = useState("")
  const [noteTitle, setNoteTitle] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)

  useEffect(() => {
    loadNotes()
    setupAudio()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
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

  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync()
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
    } catch (error) {
      console.error("Failed to setup audio:", error)
    }
  }

  const loadNotes = async () => {
    if (!booking?.id) return

    try {
      const data = await bookingService.getBookingNotes(booking.id)
      setNotes(data)
    } catch (error) {
      console.error("Failed to load notes:", error)
    }
  }

  const startRecording = async () => {
    try {
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      setRecording(recording)
      setIsRecording(true)
    } catch (error) {
      console.error("Failed to start recording:", error)
      Alert.alert("Error", "Failed to start recording")
    }
  }

  const stopRecording = async () => {
    if (!recording) return

    try {
      setIsRecording(false)
      await recording.stopAndUnloadAsync()

      const uri = recording.getURI()
      if (uri) {
        // Here you would typically upload the audio file and get transcription
        // For now, we'll simulate with a placeholder
        const simulatedTranscript =
          "Patient showed improvement in mobility. Vital signs stable. Medication taken as prescribed."
        await saveNoteWithTranscript(simulatedTranscript)
      }

      setRecording(null)
    } catch (error) {
      console.error("Failed to stop recording:", error)
      Alert.alert("Error", "Failed to stop recording")
    }
  }

  const saveNoteWithTranscript = async (transcript: string) => {
    if (!booking?.id || !noteTitle.trim()) {
      Alert.alert("Error", "Please enter a note title")
      return
    }

    try {
      setIsLoading(true)
      await bookingService.createBookingNote(booking.id, noteTitle.trim(), currentNote, transcript)

      setNoteTitle("")
      setCurrentNote("")
      loadNotes()

      Alert.alert("Success", "Note saved with AI analysis!")
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to save note")
    } finally {
      setIsLoading(false)
    }
  }

  const saveTextNote = async () => {
    if (!booking?.id || !noteTitle.trim() || !currentNote.trim()) {
      Alert.alert("Error", "Please enter both title and note content")
      return
    }

    try {
      setIsLoading(true)
      await bookingService.createBookingNote(booking.id, noteTitle.trim(), currentNote.trim())

      setNoteTitle("")
      setCurrentNote("")
      loadNotes()

      Alert.alert("Success", "Note saved!")
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to save note")
    } finally {
      setIsLoading(false)
    }
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
        {new Date(note.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  )

  if (!booking) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <Text variant="body">Booking not found</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView>
        <View style={globalStyles.container}>
          <HeaderBack />

          <View style={{ marginVertical: "5%" }}>
            <Text variant="h2" weight="bold">
              AI Note Taker
            </Text>
            <Text variant="body" color={theme.colors.textLight}>
              Record or write notes with AI analysis
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
              placeholder="Note title..."
              value={noteTitle}
              onChangeText={setNoteTitle}
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: theme.colors.text,
                marginBottom: 12,
              }}
            />

            <TextInput
              placeholder="Write your observations here..."
              value={currentNote}
              onChangeText={setCurrentNote}
              multiline
              numberOfLines={4}
              style={{
                fontSize: 16,
                color: theme.colors.text,
                textAlignVertical: "top",
                marginBottom: 16,
              }}
            />

            {/* Recording Controls */}
            <View style={[globalStyles.row, { justifyContent: "center", marginBottom: 16 }]}>
              <TouchableOpacity
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

              {isRecording && (
                <View style={{ justifyContent: "center" }}>
                  <Text variant="h3" color={theme.colors.error} weight="bold">
                    {formatDuration(recordingDuration)}
                  </Text>
                  <Text variant="small" color={theme.colors.textLight}>
                    Recording...
                  </Text>
                </View>
              )}
            </View>

            <Button title="Save Note" onPress={saveTextNote} loading={isLoading} />
          </View>

          {/* Previous Notes */}
          <View>
            <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
              Previous Notes ({notes.length})
            </Text>
            {notes.map(renderNote)}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default AINoteTaker
