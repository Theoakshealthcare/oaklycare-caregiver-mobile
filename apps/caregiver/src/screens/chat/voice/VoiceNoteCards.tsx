import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import { formatStamp } from "@/src/utils/dates"
import { useVoiceNote } from "@/src/hooks/useVoiceNotes"
import { failureMessage } from "@/src/voiceNotes/messages"
import type { VoiceNote } from "@/src/voiceNotes/types"

const box = { backgroundColor: theme.colors.white, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border } as const

/** After this long without a result the card says so (spec 3.4: never give up silently) and stops asking. */
export const TRANSCRIBE_SLOW_AFTER_MS = 3 * 60_000

interface TranscribingProps {
  note: VoiceNote
  /** Called once when the note becomes `ready` (or `failed`), with the note as the server now has it. */
  onSettled: (note: VoiceNote) => void
  onDiscard: (noteId: string) => void
}

/** The "transcribing" state: a spinner and one sentence, polling the note until it is no longer being processed. */
export const TranscribingCard: React.FC<TranscribingProps> = ({ note, onSettled, onDiscard }) => {
  const [slow, setSlow] = useState(false)
  const query = useVoiceNote(note.id, !slow)
  const current = query.data ?? note
  const settled = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), TRANSCRIBE_SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!settled.current && current.status !== "processing" && current.status !== "awaiting_audio") {
      settled.current = true
      onSettled(current)
    }
  }, [current, onSettled])

  return (
    <View testID="transcribing-card" style={box}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text variant="body" weight="bold" style={{ flex: 1 }}>
          Turning your recording into text...
        </Text>
      </View>
      <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 8 }} testID="transcribing-hint">
        {slow ? "This is taking longer than usual. You can check again or discard the recording." : "This usually takes under a minute. You can leave this screen and come back."}
      </Text>
      {slow ? (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Button title="Check again" variant="outline" testID="transcribing-check" onPress={() => { setSlow(false); void query.refetch() }} style={{ flex: 1 }} />
          <Button title="Discard" variant="ghost" testID="transcribing-discard" onPress={() => onDiscard(note.id)} style={{ flex: 1 }} />
        </View>
      ) : null}
    </View>
  )
}

interface FailedProps {
  note: VoiceNote
  retrying: boolean
  onRetry: (noteId: string) => void
  onDiscard: (noteId: string) => void
  onType: () => void
}

/** A failed note: the sentence for its `error.code`, and Try again only when the server says a retry can work. */
export const FailedCard: React.FC<FailedProps> = ({ note, retrying, onRetry, onDiscard, onType }) => (
  <View testID="failed-card" style={box} accessibilityRole="alert">
    <Text variant="body" weight="bold" color={theme.colors.error} testID="failed-message">
      {failureMessage(note.error)}
    </Text>
    <View style={{ flexDirection: "row", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
      {note.error?.retryable ? <Button title="Try again" testID="failed-retry" loading={retrying} onPress={() => onRetry(note.id)} style={{ flex: 1 }} /> : <Button title="Type my note" testID="failed-type" onPress={onType} style={{ flex: 1 }} />}
      <Button title="Discard" variant="outline" testID="failed-discard" onPress={() => onDiscard(note.id)} style={{ flex: 1 }} />
    </View>
  </View>
)

interface ReadyProps {
  onReview: () => void
  onDiscard: () => void
}

/** A draft waiting for the caregiver (they left the screen, or came back later). */
export const ReadyCard: React.FC<ReadyProps> = ({ onReview, onDiscard }) => (
  <View testID="ready-card" style={box}>
    <Text variant="body" weight="bold">
      A voice note is ready to check
    </Text>
    <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 4 }}>
      It is only a draft until you save it.
    </Text>
    <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
      <Button title="Review and save" testID="ready-review" onPress={onReview} style={{ flex: 1 }} />
      <Button title="Discard" variant="outline" testID="ready-discard" onPress={onDiscard} style={{ flex: 1 }} />
    </View>
  </View>
)

interface PendingProps {
  sending: boolean
  message: string | null
  onRetry: () => void
  onDiscard: () => void
}

/** A recording that has not reached the server yet: sending, or the sentence for why not, with Try again. */
export const PendingUploadCard: React.FC<PendingProps> = ({ sending, message, onRetry, onDiscard }) => (
  <View testID="pending-card" style={box}>
    {sending ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text variant="body" weight="bold" style={{ flex: 1 }}>
          Sending your recording...
        </Text>
      </View>
    ) : (
      <>
        <Text variant="body" weight="bold" color={theme.colors.error} testID="pending-message" accessibilityRole="alert">
          {message}
        </Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Button title="Try again" testID="pending-retry" onPress={onRetry} style={{ flex: 1 }} />
          <Button title="Discard" variant="outline" testID="pending-discard" onPress={onDiscard} style={{ flex: 1 }} />
        </View>
      </>
    )}
  </View>
)

/** A saved voice note: the caregiver's final text (summary first, then the transcript), as saved. */
export const SavedVoiceNoteCard: React.FC<{ note: VoiceNote }> = ({ note }) => (
  <View testID={`saved-note-${note.id}`} style={{ ...box, borderWidth: 0, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
    <Text variant="small" color={theme.colors.textLight} style={{ marginBottom: 8 }}>
      {`Voice note, ${note.language === "pcm" ? "Pidgin" : "English"}${note.edited ? ", edited by you" : ""}`}
    </Text>
    {note.summary ? (
      <View style={{ backgroundColor: theme.colors.primaryLight, padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <Text variant="small" color={theme.colors.primary} weight="bold" style={{ marginBottom: 4 }}>
          Summary
        </Text>
        <Text variant="body" color={theme.colors.primary} testID="saved-summary">
          {note.summary}
        </Text>
      </View>
    ) : null}
    <Text variant="body" style={{ lineHeight: 22 }} testID="saved-transcript">
      {note.transcript}
    </Text>
    {note.saved_at ? (
      <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 8 }}>
        {formatStamp(note.saved_at)}
      </Text>
    ) : null}
  </View>
)

/** A note whose audio never reached the server (the app closed, or the send failed and the caregiver moved on). */
export const UnsentCard: React.FC<{ onDiscard: () => void }> = ({ onDiscard }) => (
  <View testID="unsent-card" style={box}>
    <Text variant="body" weight="bold">
      A recording was started but never sent
    </Text>
    <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 4 }}>
      Record again, or discard this one.
    </Text>
    <Button title="Discard" variant="outline" testID="unsent-discard" onPress={onDiscard} style={{ marginTop: 12 }} />
  </View>
)
