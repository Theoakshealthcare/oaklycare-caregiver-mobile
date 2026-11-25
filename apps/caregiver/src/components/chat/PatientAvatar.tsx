import React, { useState } from "react";
import { View } from "react-native";

import { initialOf } from "@/src/chats/chatsModel";
import Image from "@/src/components/ui/image";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/**
 * A round patient avatar: the photo when there is one (and it loads), otherwise the first letter on pale teal. Used by
 * the Chats list, its avatar row and the chat room header, so the three always agree.
 */
const PatientAvatar: React.FC<{
  name: string;
  uri?: string | null;
  size: number;
  /** testID of the first-letter fallback. */
  initialTestID?: string;
  testID?: string;
}> = ({ name, uri, size, initialTestID, testID }) => {
  const [failed, setFailed] = useState(false);
  const photo = uri && !failed ? uri : null;
  return (
    <View
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: theme.colors.primaryLight,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {photo ? (
        <Image
          testID={testID ? `${testID}-photo` : "patient-avatar-photo"}
          source={{ uri: photo }}
          showLoader={false}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          containerStyle={{ width: size, height: size }}
          imageStyle={{ width: size, height: size }}
        />
      ) : (
        <Text variant={size > 48 ? "h3" : "body"} weight="bold" color={theme.colors.primary} testID={initialTestID}>
          {initialOf(name)}
        </Text>
      )}
    </View>
  );
};

export default PatientAvatar;
