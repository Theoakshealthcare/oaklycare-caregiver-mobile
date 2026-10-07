import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import ScreenShell from "@/src/components/account/ScreenShell";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { FAQ_ITEMS } from "@/src/content/faq";

const Faq: React.FC = () => {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ScreenShell title="Frequently asked questions">
      {FAQ_ITEMS.map((item, index) => {
        const expanded = open === index;
        return (
          <View key={item.question} style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 14 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : index)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Text variant="body" weight="bold" color={theme.colors.primary}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text variant="body" weight="medium" style={{ flex: 1 }}>
                {item.question}
              </Text>
              <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.text} />
            </Pressable>
            {expanded ? (
              <Text variant="body" color={theme.colors.textLight} style={{ marginTop: 8, marginLeft: 32 }}>
                {item.answer}
              </Text>
            ) : null}
          </View>
        );
      })}
    </ScreenShell>
  );
};

export default Faq;
