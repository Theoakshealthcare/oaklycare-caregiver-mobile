"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { View, TouchableOpacity, Alert, Linking, Keyboard, type LayoutChangeEvent } from "react-native"
import { useQueryClient } from "@tanstack/react-query"
import { Feather } from "@expo/vector-icons"
import { errorCode, isVisitNotActiveError, NOT_FOUND, notesWindow } from "@oakly/api-client"
import type { StackScreenProps } from "@react-navigation/stack"
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import KeyboardScrollView, { type KeyboardScrollHandle } from "@/src/components/ui/keyboard-scroll-view"
import KeyboardInsetView from "@/src/components/ui/keyboard-inset-view"
import BottomCta from "@/src/components/ui/bottom-cta"
import Input from "@/src/components/ui/input"
import Notice from "@/src/components/ui/notice"
import PostVisitLinks from "@/src/components/visit/PostVisitLinks"
import AiOrb from "@/src/components/chat/AiOrb"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import { ApiError, messageForError } from "@/src/api/errors"
import { formatStamp, formatUntil } from "@/src/utils/dates"
import { useBooking, useCreateNote, useNotes } from "@/src/hooks/queries"
import { queryKeys } from "@/src/api/keys"
import { voiceNotesMode } from "@/src/config/voiceNotes"
import useNavigation from "@/src/hooks/use-navigation"
import {
  useDiscardVoiceNote,
  useRetryVoiceNote,
  useSubmitRecording,
  useVisitVoiceNotes,
  type RecordingJob,
} from "@/src/hooks/useVoiceNotes"
import { deleteLocalFile, forgetLocalRecording, newRequestId } from "@/src/voiceNotes/localAudio"
import { voiceNoteErrorMessage } from "@/src/voiceNotes/messages"
import { useVisitConsent } from "@/src/voiceNotes/useVisitConsent"
import { RECORDING_MIME, VOICE_NOTE_LIMITS, type VoiceNote, type VoiceNoteLanguage } from "@/src/voiceNotes/types"
import ConsentCard from "@/src/screens/chat/voice/ConsentCard"
import {
  FailedCard,
  PendingUploadCard,
  ReadyCard,
  SavedVoiceNoteCard,
  TranscribingCard,
  UnsentCard,
} from "@/src/screens/chat/voice/VoiceNoteCards"
import type { BookingNote } from "@/src/services/booking.service"
import type { ScreenParamLists } from "@/src/navigation/Navigations"

export const NOTES_CLOSED = "Notes for this visit are closed."
export const NOTES_NOT_SAVED = "Your note could not be saved."
export const NOTES_GONE = "These notes are no longer available."

const AINoteTaker: React.FC<StackScreenProps<ScreenParamLists, "AINoteTaker">> = ({ route }) => {
  const { bookingId } = route.params

  const [isRecording, setIsRecording] = useState(false)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const notesQuery = useNotes(bookingId)
  const notes = notesQuery.data ?? []
  const createNote = useCreateNote(bookingId)
  const { data: booking } = useBooking(bookingId)

  // Notes can be added during the visit and for 2 h after it (`notes_open`), and read by the caregiver for 24 h after it
  // (`notes_readable_until`; after that the API answers 404 `not_found`). A missing field counts as open. A save that
  // comes back 409 `visit_not_active` means the window ended while the note was being typed: the text stays on screen.
  const win = notesWindow(booking)
  // When this screen opened: a notes window that had already ended by then is not drawn (a clock read during render would not be pure).
  const [openedAt] = useState(() => Date.now())
  const [closedByServer, setClosedByServer] = useState(false)
  const readError = notesQuery.error
  const notesGone =
    (readError instanceof ApiError && readError.status === 404 && errorCode(readError.body) === NOT_FOUND) ||
    (win.readableUntil !== null && win.readableUntil.getTime() <= openedAt)
  // Closed by what the payload (or a 404) says: nothing to type into, so no entry forms at all.
  const entryClosed = !win.open || notesGone
  // Closed by a 409 on save: the typed note stays visible, but it can no longer be saved.
  const closed = entryClosed || closedByServer
  const [currentNote, setCurrentNote] = useState("")
  const [noteTitle, setNoteTitle] = useState("")
  const [recordingDuration, setRecordingDuration] = useState(0)
  const banner = closed
    ? closedByServer && !entryClosed && (noteTitle.trim() || currentNote.trim())
      ? `${NOTES_CLOSED} ${NOTES_NOT_SAVED}`
      : NOTES_CLOSED
    : win.closesAt
      ? `Visit complete. You can add notes until ${formatUntil(win.closesAt)}.`
      : null

  // Bringing the typed-note fields into view: the pinned Save Note bar shrinks the scroll area when the keyboard opens, so
  // the page is scrolled to the form by hand, once the area has its new height (or at once if the keyboard is already up).
  const scrollRef = useRef<KeyboardScrollHandle>(null)
  const formTop = useRef(0)
  const formFocused = useRef(false)
  const scrollToForm = useCallback(() => scrollRef.current?.scrollTo({ y: Math.max(0, formTop.current - theme.spacing.sm), animated: true }), [])
  const onFormFocus = () => {
    formFocused.current = true
    if (Keyboard.isVisible()) setTimeout(scrollToForm, 50)
  }
  const onFormBlur = () => {
    formFocused.current = false
  }
  const onScrollAreaResized = (_event: LayoutChangeEvent) => {
    if (formFocused.current) scrollToForm()
  }

  // The voice note flow (consent, upload, transcribe, review). Off by default: the screen then behaves as it always has.
  const voiceOn = voiceNotesMode() !== "off"
  const { navigation } = useNavigation()
  const client = useQueryClient()
  const consent = useVisitConsent(bookingId, voiceOn)
  const [language, setLanguage] = useState<VoiceNoteLanguage>("en")
  const [pending, setPending] = useState<RecordingJob | null>(null)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const voiceNotes = useVisitVoiceNotes(bookingId).data ?? []
  const submit = useSubmitRecording(bookingId)
  const retry = useRetryVoiceNote(bookingId)
  const discard = useDiscardVoiceNote(bookingId)
  const [actionError, setActionError] = useState<string | null>(null)

  const sendRecording = (job: RecordingJob) => {
    setPending(job)
    setActionError(null)
    submit.mutate(job, {
      onSuccess: (note) => {
        setPending(null)
        setActiveNoteId(note.id)
      },
    })
  }

  const discardPending = () => {
    if (pending) deleteLocalFile(pending.recording.uri)
    setPending(null)
    submit.reset()
  }

  const discardNote = (noteId: string) => {
    setActionError(null)
    discard.mutate(noteId, { onError: (e) => setActionError(voiceNoteErrorMessage(e)) })
  }

  const retryNote = (noteId: string) => {
    setActionError(null)
    retry.mutate(noteId, { onError: (e) => setActionError(voiceNoteErrorMessage(e)) })
  }

  const openReview = useCallback(
    (noteId: string) => navigation.navigate("VoiceNoteReview", { bookingId, noteId }),
    [navigation, bookingId],
  )

  // A note that finished: the phone's copy of the audio is no longer needed, and the one the caregiver just recorded
  // opens straight on the review screen.
  const onSettled = useCallback(
    (note: VoiceNote) => {
      if (note.status === "ready") forgetLocalRecording(note.id)
      void client.invalidateQueries({ queryKey: queryKeys.voiceNotes(bookingId) })
      if (note.status === "ready" && note.id === activeNoteId) {
        setActiveNoteId(null)
        openReview(note.id)
      }
    },
    [client, bookingId, activeNoteId, openReview],
  )

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
    const seconds = recordingDuration

    try {
      setIsRecording(false)
      await recorder.stop()

      if (voiceOn) {
        const uri = recorder.uri
        if (!uri) {
          Alert.alert("Error", "The recording could not be saved. Please try again.")
          return
        }
        if (seconds < VOICE_NOTE_LIMITS.minSeconds) {
          deleteLocalFile(uri)
          Alert.alert("Recording too short", "Record a little longer, or type your note.")
          return
        }
        sendRecording({
          clientRequestId: newRequestId(),
          recording: { uri, mime: RECORDING_MIME },
          durationSeconds: Math.min(seconds, VOICE_NOTE_LIMITS.maxSeconds),
          language,
        })
        return
      }

      // Voice notes are off: there is no audio upload or transcription in this build, so a recording is not saved and no
      // transcript is invented. The caregiver writes the note by hand.
      Alert.alert("Recording stopped", "Voice transcription isn't available yet. Please type your note below.")
    } catch (error) {
      console.error("Failed to stop recording:", error)
      Alert.alert("Error", "Failed to stop recording")
    }
  }

  // A recording stops by itself at the longest the backend accepts and is sent as it is.
  useEffect(() => {
    if (voiceOn && isRecording && recordingDuration >= VOICE_NOTE_LIMITS.maxSeconds) void stopRecording()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingDuration, isRecording, voiceOn])

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
        onError: (error) => {
          if (isVisitNotActiveError(error instanceof ApiError ? error.body : null)) {
            setClosedByServer(true)
            // The booking carries the times: read it again so the banner is right when the screen is opened next.
            void client.invalidateQueries({ queryKey: queryKeys.booking(bookingId) })
            return
          }
          Alert.alert("Error", messageForError(error))
        },
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

  const micLocked = voiceOn && !consent.consented && !isRecording

  const recordingIndicator = isRecording ? (
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
        Tap to stop
      </Text>
    </View>
  ) : null

  return (
    <KeyboardInsetView style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <KeyboardScrollView innerScrollRef={scrollRef} onLayout={onScrollAreaResized}>
        <View style={globalStyles.container}>
          <HeaderBack />

          <View style={{ marginVertical: "5%" }}>
            <Text variant="page" weight="bold">
              AI Notetaker
            </Text>
            {voiceOn ? null : (
              <Text variant="body" color={theme.colors.textLight}>
                Write notes for this visit. Voice recordings are not transcribed yet.
              </Text>
            )}
            {voiceNotesMode() === "fake" ? (
              <Text variant="small" color={theme.colors.warningText} testID="fake-mode-banner" style={{ marginTop: 8 }}>
                Test mode: voice notes use sample text. Nothing you record leaves this phone.
              </Text>
            ) : null}
          </View>

          {banner ? <Notice testID="notes-window-banner" message={banner} style={{ marginBottom: theme.spacing.lg }} /> : null}

          <PostVisitLinks bookingId={bookingId} completed={booking?.status === "completed"} />

          {voiceOn && !closed ? (
            <View>
              {consent.loaded && !consent.consented ? <ConsentCard checked={false} onChange={consent.setConsented} /> : null}
              {consent.consented ? (
                <View style={[globalStyles.row, { marginBottom: 12, justifyContent: "space-between" }]} testID="consent-given">
                  <Text variant="small" color={theme.colors.textLight} style={{ flex: 1 }}>
                    You confirmed the client agreed to recording for this visit.
                  </Text>
                  <TouchableOpacity testID="consent-undo" accessibilityRole="button" onPress={() => consent.setConsented(false)}>
                    <Text variant="small" color={theme.colors.primary} weight="bold">
                      Undo
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {pending ? (
                <PendingUploadCard
                  sending={submit.isPending}
                  message={submit.isError ? voiceNoteErrorMessage(submit.error) : null}
                  onRetry={() => sendRecording(pending)}
                  onDiscard={discardPending}
                />
              ) : null}
              {actionError ? (
                <Text variant="body" color={theme.colors.error} testID="voice-action-error" accessibilityRole="alert" style={{ marginBottom: 12 }}>
                  {actionError}
                </Text>
              ) : null}
              {voiceNotes
                .filter((note) => note.status !== "saved")
                .map((note) => {
                  if (note.status === "processing") return <TranscribingCard key={note.id} note={note} onSettled={onSettled} onDiscard={discardNote} />
                  if (note.status === "ready") return <ReadyCard key={note.id} onReview={() => openReview(note.id)} onDiscard={() => discardNote(note.id)} />
                  if (note.status === "failed") {
                    return (
                      <FailedCard
                        key={note.id}
                        note={note}
                        retrying={retry.isPending}
                        onRetry={retryNote}
                        onDiscard={discardNote}
                        onType={() => discardNote(note.id)}
                      />
                    )
                  }
                  return pending ? null : <UnsentCard key={note.id} onDiscard={() => discardNote(note.id)} />
                })}
            </View>
          ) : null}

          {/* Voice to text (Figma "I'm Listening"): the orb, the Voice to text pill, and the language choice */}
          {voiceOn && !closed ? (
            <View testID="voice-panel" style={{ alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              <Text variant="body" color={theme.colors.textLight} testID="listening-label">
                {isRecording ? "I'm Listening" : "Ready to listen"}
              </Text>
              <AiOrb testID="ai-orb" />
              {recordingIndicator}
              {!isRecording ? (
                <View style={[globalStyles.row, { justifyContent: "center", gap: 8 }]}>
                  {(["en", "pcm"] as const).map((code) => (
                    <TouchableOpacity
                      key={code}
                      testID={`language-${code}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: language === code }}
                      onPress={() => setLanguage(code)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 16,
                        backgroundColor: language === code ? theme.colors.primary : theme.colors.background,
                      }}
                    >
                      <Text variant="small" weight="bold" color={language === code ? theme.colors.white : theme.colors.text}>
                        {code === "en" ? "English" : "Pidgin"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity
                testID="mic-button"
                accessibilityRole="button"
                accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
                accessibilityState={{ disabled: micLocked }}
                disabled={micLocked}
                onPress={isRecording ? stopRecording : startRecording}
                style={{
                  opacity: micLocked ? 0.4 : 1,
                  width: "100%",
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderWidth: 1,
                  borderColor: isRecording ? theme.colors.error : theme.colors.primary,
                  borderRadius: theme.borderRadius.round,
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                <Text variant="small" color={isRecording ? theme.colors.error : theme.colors.primary}>
                  {isRecording ? "Tap to stop" : "Voice to text"}
                </Text>
                <Feather name={isRecording ? "square" : "mic"} size={18} color={isRecording ? theme.colors.error : theme.colors.primary} />
              </TouchableOpacity>
              <Text variant="small" color={theme.colors.textLight} style={{ alignSelf: "flex-start" }}>
                A recording becomes text you can check and edit before you save it. Or type your note below.
              </Text>
            </View>
          ) : null}

          {/* Note Input: two labelled, outlined fields (the shared Input), Save Note is the pinned bar under the page */}
          {entryClosed ? null : (
          <View
            testID="note-form"
            onLayout={(event) => {
              formTop.current = event.nativeEvent.layout.y
            }}
            style={{ marginBottom: 20, gap: theme.spacing.md }}
          >
            <Text variant="h3" weight="bold">
              Write a note
            </Text>

            <Input
              label="Title"
              placeholder="Note title"
              value={noteTitle}
              onChangeText={setNoteTitle}
              editable={!closed}
              onFocus={onFormFocus}
              onBlur={onFormBlur}
              returnKeyType="next"
              accessibilityLabel="Note title"
            />

            <Input
              label="Note"
              placeholder="Write your note here"
              value={currentNote}
              onChangeText={setCurrentNote}
              editable={!closed}
              onFocus={onFormFocus}
              onBlur={onFormBlur}
              multiline
              inputStyle={{ minHeight: 140, maxHeight: 200, textAlignVertical: "top" }}
              accessibilityLabel="Write your note here"
            />

            {/* Recording Controls: the typed screen keeps its round mic; with voice notes on the Voice to text pill above replaces it */}
            {voiceOn || closed ? null : (
              <View style={[globalStyles.row, { justifyContent: "center" }]}>
                <TouchableOpacity
                  testID="mic-button"
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
                  accessibilityState={{ disabled: false }}
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
            )}

            {voiceOn ? null : recordingIndicator}
          </View>
          )}

          {/* Saved voice notes: the final text the caregiver saved */}
          {voiceOn && voiceNotes.some((note) => note.status === "saved") ? (
            <View testID="saved-voice-notes">
              <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
                Voice notes
              </Text>
              {voiceNotes
                .filter((note) => note.status === "saved")
                .map((note) => (
                  <SavedVoiceNoteCard key={note.id} note={note} />
                ))}
            </View>
          ) : null}

          {/* Previous Notes */}
          <View>
            <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
              {notesGone ? "Previous Notes" : `Previous Notes (${notes.length})`}
            </Text>
            {notesGone ? (
              <Text variant="body" color={theme.colors.textLight} testID="notes-gone">
                {NOTES_GONE}
              </Text>
            ) : notes.length === 0 ? (
              <Text variant="body" color={theme.colors.textLight} testID="notes-empty">
                No notes for this visit yet. Notes you save appear here.
              </Text>
            ) : (
              notes.map(renderNote)
            )}
          </View>
        </View>
      </KeyboardScrollView>

      {/* Save Note stays under the page, above the keyboard and with the shared bottom gap */}
      {closed ? null : (
        <BottomCta testID="note-save-bar" style={{ backgroundColor: theme.colors.white }}>
          <Button title="Save Note" onPress={saveTextNote} loading={createNote.isPending} />
        </BottomCta>
      )}
    </KeyboardInsetView>
  )
}

export default AINoteTaker
