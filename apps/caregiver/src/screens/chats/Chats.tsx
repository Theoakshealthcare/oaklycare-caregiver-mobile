import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { AVATAR_ROW_LIMIT, NO_MESSAGES_YET, filterChats, initialOf, listTime } from "@/src/chats/chatsModel";
import { MAX_FONT_SCALE, theme } from "@/src/constants/theme";
import { useChatList } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import type { ChatSummary } from "@/src/services/chats.service";

const ROW_AVATAR = 48;
const STRIP_AVATAR = 62;
/** The side margin of the Bookings screen, so the two tabs line up. */
const GUTTER = 20;

/** A round avatar with the patient's first letter (the list carries no photo). */
const Avatar: React.FC<{ name: string; size: number; testID?: string }> = ({ name, size, testID }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: theme.colors.primaryLight,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text variant={size > ROW_AVATAR ? "h3" : "body"} weight="bold" color={theme.colors.primary} testID={testID}>
      {initialOf(name)}
    </Text>
  </View>
);

const ChatRow: React.FC<{ chat: ChatSummary; onOpen: (chat: ChatSummary) => void }> = ({ chat, onOpen }) => {
  const last = chat.last_message;
  return (
    <Pressable
      testID={`chat-row-${chat.booking_id}`}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${chat.patient_name}`}
      onPress={() => onOpen(chat)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        backgroundColor: theme.colors.white,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
      }}
    >
      <Avatar name={chat.patient_name} size={ROW_AVATAR} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" weight="bold" numberOfLines={1} testID="chat-row-name">
          {chat.patient_name}
        </Text>
        <Text variant="label" color={theme.colors.textLight} numberOfLines={2} testID="chat-row-preview">
          {last ? last.text : NO_MESSAGES_YET}
        </Text>
      </View>
      {last ? (
        <Text variant="label" weight="medium" color={theme.colors.textLight} testID="chat-row-time">
          {listTime(last.sent_at)}
        </Text>
      ) : null}
    </Pressable>
  );
};

/**
 * The Chats tab (Figma 8.21.06): a teal header with a search box, the avatars of the latest conversations, then one row
 * per conversation. Left out because nothing backs them: the "Oakly Admin" support conversation and the filter button
 * beside the search box. No unread badge either: the server records no read state.
 */
const Chats: React.FC<{ active?: boolean }> = ({ active = true }) => {
  const navigation = useNavigation().navigation;
  const list = useChatList(active);
  const [query, setQuery] = useState("");

  const { refetch } = list;
  // Coming back from a conversation: the list shows what was just said.
  useFocusEffect(
    useCallback(() => {
      if (active) void refetch();
    }, [active, refetch]),
  );

  const chats = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const visible = useMemo(() => filterChats(chats, query), [chats, query]);
  const searching = query.trim().length > 0;

  const open = (chat: ChatSummary) =>
    navigation.navigate("ChatScreen", { bookingId: chat.booking_id, patientName: chat.patient_name });

  const renderBody = () => {
    if (list.isLoading) return <LoadingState testID="chats-loading" />;
    if (list.isError && chats.length === 0) {
      return (
        <View style={{ paddingHorizontal: GUTTER }} testID="chats-error">
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </View>
      );
    }
    return (
      <FlatList
        testID="chats-list"
        data={visible}
        keyExtractor={(chat) => chat.booking_id}
        renderItem={({ item }) => <ChatRow chat={item} onOpen={open} />}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} />}
        ListHeaderComponent={
          !searching && chats.length > 0 ? (
            <ScrollView
              testID="chats-avatar-row"
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: GUTTER }}
              contentContainerStyle={{ gap: theme.spacing.md }}
            >
              {chats.slice(0, AVATAR_ROW_LIMIT).map((chat) => (
                <Pressable
                  key={chat.booking_id}
                  testID={`chats-avatar-${chat.booking_id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Chat with ${chat.patient_name}`}
                  onPress={() => open(chat)}
                >
                  <Avatar name={chat.patient_name} size={STRIP_AVATAR} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: theme.spacing.xxl, paddingHorizontal: GUTTER }} testID="chats-empty">
            <Feather name="message-circle" size={44} color={theme.colors.primary} style={{ marginBottom: theme.spacing.sm }} />
            <Text variant="h3" weight="bold" center style={{ marginBottom: theme.spacing.sm }}>
              {searching ? "No chats found" : "No chats yet"}
            </Text>
            <Text variant="body" color={theme.colors.textLight} center>
              {searching
                ? `No conversation matches "${query.trim()}".`
                : "Chats with your clients appear here once you accept a booking. Pull down to refresh."}
            </Text>
          </View>
        }
        ListFooterComponent={
          list.hasNextPage && !searching ? (
            <Button
              title={list.isFetchingNextPage ? "Loading..." : "Load earlier chats"}
              onPress={() => void list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
            />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : null
        }
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }} testID="chats-screen">
      <View style={{ paddingTop: 50, paddingHorizontal: GUTTER, paddingBottom: GUTTER, gap: theme.spacing.lg }}>
        <Text variant="page" weight="bold" color={theme.colors.white}>
          Chats
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            backgroundColor: theme.colors.white,
            borderRadius: theme.borderRadius.xl,
            paddingHorizontal: theme.spacing.md,
            height: 46,
          }}
        >
          <Feather name="search" size={18} color={theme.colors.textLight} />
          <TextInput
            testID="chats-search"
            accessibilityLabel="Search chats"
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={theme.colors.textLight}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={{ flex: 1, fontFamily: theme.fonts.regular, fontSize: theme.sizes.compact, color: theme.colors.text, paddingVertical: 0 }}
          />
          {searching ? (
            <Pressable testID="chats-search-clear" accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery("")}>
              <Feather name="x" size={18} color={theme.colors.textLight} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: GUTTER,
        }}
      >
        {renderBody()}
      </View>
    </View>
  );
};

export default Chats;
