import type React from "react"
import { useEffect, useState } from "react"
import { ActivityIndicator, Alert, TextInput, View } from "react-native"
import type { StackScreenProps } from "@react-navigation/stack"

import { theme, MAX_FONT_SCALE } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import { formatStamp } from "@/src/utils/dates"
import useNavigation from "@/src/hooks/use-navigation"
import { useDiscardVoiceNote, useSaveVoiceNote, useVoiceNote } from "@/src/hooks/useVoiceNotes"
import { requestCodeOf, voiceNoteErrorMessage } from "@/src/voiceNotes/messages"
import { VOICE_NOTE_LIMITS } from "@/src/voiceNotes/types"
import type { ScreenParamLists } from "@/src/navigation/Navigations"

const fieldBox = {
  backgroundColor: theme.colors.white,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: theme.colors.border,
  padding: 12,
  marginBottom: 16,
  minHeight: 120,
} as const

/**
 * Check, edit and save a voice note (owner decision D5). The text arrives as an AI draft; nothing is saved until the
 * caregiver taps Save, and Discard deletes the note on the server (spec 3.6).
 */
const VoiceNoteReview: React.FC<StackScreenProps<ScreenParamLists, "VoiceNoteReview">> = ({ route }) => {
  const { bookingId, noteId } = route.params
  const { navigation } = useNavigation()
  const query = useVoiceNote(noteId)
  const save = useSaveVoiceNote(bookingId)
  const discard = useDiscardVoiceNote(bookingId)
  const note = query.data

  const [transcript, setTranscript] = useState("")
  const [summary, setSummary] = useState("")
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The fields start from the draft once, so a later refetch never overwrites what the caregiver is typing.
  useEffect(() => {
    if (note && note.status !== "processing" && loadedFor !== note.id) {
      setTranscript(note.transcript ?? "")
      setSummary(note.summary ?? "")
      setLoadedFor(note.id)
    }
  }, [note, loadedFor])

  const goBack = () => navigation.goBack()

  const onSave = () => {
    setError(null)
    save.mutate(
      { noteId, text: { transcript: transcript.trim(), summary: summary.trim() } },
      {
        onSuccess: () => navigation.goBack(),
        // `already_saved` and `not_found` mean this screen is stale: say so and leave the text in place.
        onError: (e) => setError(voiceNoteErrorMessage(e)),
      },
    )
  }

  const onDiscard = () =>
    Alert.alert("Discard this note?", "The text is deleted and cannot be brought back.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => discard.mutate(noteId, { onSuccess: goBack, onError: (e) => setError(voiceNoteErrorMessage(e)) }),
      },
    ])

  const header = (
    <>
      <HeaderBack />
      <View style={{ marginVertical: "5%" }}>
        <Text variant="page" weight="bold">
          Check your voice note
        </Text>
      </View>
    </>
  )

  if (query.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
        <View style={globalStyles.container}>
          {header}
          <ActivityIndicator testID="review-loading" color={theme.colors.primary} />
        </View>
      </View>
    )
  }

  if (query.isError || !note) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
        <View style={globalStyles.container}>
          {header}
          <Text variant="body" color={theme.colors.error} testID="review-error">
            {voiceNoteErrorMessage(query.error)}
          </Text>
          <Button title="Back" variant="outline" onPress={goBack} style={{ marginTop: 16 }} />
        </View>
      </View>
    )
  }

  if (note.status === "saved") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
        <KeyboardScrollView>
          <View style={globalStyles.container}>
            {header}
            <Text variant="small" color={theme.colors.textLight} testID="review-saved-banner">
              {`Saved${note.saved_at ? ` ${formatStamp(note.saved_at)}` : ""}${note.edited ? ", edited by you" : ""}`}
            </Text>
            <Text variant="small" weight="bold" style={{ marginTop: 16 }}>Summary</Text>
            <Text variant="body" testID="review-saved-summary">{note.summary || "No summary."}</Text>
            <Text variant="small" weight="bold" style={{ marginTop: 16 }}>Transcript</Text>
            <Text variant="body" testID="review-saved-transcript">{note.transcript}</Text>
            <Button title="Back" variant="outline" onPress={goBack} style={{ marginTop: 24 }} />
          </View>
        </KeyboardScrollView>
      </View>
    )
  }

  if (note.status !== "ready") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
        <View style={globalStyles.container}>
          {header}
          <Text variant="body" testID="review-not-ready">
            This note isn&apos;t ready to check yet. Go back to the notes screen to see where it is.
          </Text>
          <Button title="Back" variant="outline" onPress={goBack} style={{ marginTop: 16 }} />
        </View>
      </View>
    )
  }

  const canSave = transcript.trim().length > 0 && !save.isPending && !discard.isPending
  const stale = error !== null && (requestCodeOf(save.error) === "already_saved" || requestCodeOf(save.error) === "not_found")

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <KeyboardScrollView>
        <View style={globalStyles.container}>
          {header}
          <View style={{ backgroundColor: theme.colors.secondaryLight, borderRadius: 12, padding: 12, marginBottom: 16 }} accessibilityRole="alert">
            <Text variant="small" weight="bold" testID="review-draft-notice">
              AI draft. Read it and correct anything wrong before you save, especially names, numbers and medicines.
            </Text>
          </View>

          <Text variant="small" weight="bold" style={{ marginBottom: 4 }}>
            Summary
          </Text>
          {note.summary_available ? null : (
            <Text variant="small" color={theme.colors.textLight} testID="review-no-summary" style={{ marginBottom: 4 }}>
              We couldn&apos;t write a summary. You can write one, or leave it empty.
            </Text>
          )}
          <View style={fieldBox}>
            <TextInput
              testID="review-summary"
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              value={summary}
              onChangeText={setSummary}
              multiline
              maxLength={VOICE_NOTE_LIMITS.summaryMax}
              placeholder="A short summary of the visit..."
              style={{ fontSize: theme.sizes.body, color: theme.colors.text, textAlignVertical: "top" }}
            />
          </View>

          <Text variant="small" weight="bold" style={{ marginBottom: 4 }}>
            Transcript
          </Text>
          <View style={{ ...fieldBox, minHeight: 200 }}>
            <TextInput
              testID="review-transcript"
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              value={transcript}
              onChangeText={setTranscript}
              multiline
              maxLength={VOICE_NOTE_LIMITS.transcriptMax}
              placeholder="What was said..."
              style={{ fontSize: theme.sizes.body, color: theme.colors.text, textAlignVertical: "top" }}
            />
          </View>

          {error ? (
            <Text variant="body" color={theme.colors.error} testID="review-save-error" accessibilityRole="alert" style={{ marginBottom: 12 }}>
              {error}
            </Text>
          ) : null}

          <Button title="Save note" testID="review-save" onPress={onSave} loading={save.isPending} disabled={!canSave || stale} />
          <Button title="Discard" testID="review-discard" variant="outline" onPress={onDiscard} loading={discard.isPending} style={{ marginTop: 12 }} />
        </View>
      </KeyboardScrollView>
    </View>
  )
}

export default VoiceNoteReview
