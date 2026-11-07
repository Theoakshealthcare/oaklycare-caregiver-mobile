import type React from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { theme } from "@/src/constants/theme";

import Button from "./button";
import { EmptyState } from "./card";

/** "We couldn't load X" with the reason in plain words and a retry button; shown when a query failed and has nothing to show. */
const QueryError: React.FC<{ what: string; error: unknown; onRetry: () => void }> = ({ what, error, onRetry }) => (
  <View style={{ gap: theme.spacing.md }}>
    <EmptyState title={`We couldn't load ${what}`} message={messageForError(error)} />
    <Button title="Try again" onPress={onRetry} />
  </View>
);

export default QueryError;
