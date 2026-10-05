import type React from "react";
import type { ReactNode } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  type StyleProp,
  type ViewStyle,
  Pressable,
} from "react-native";
import { theme } from "../../constants/theme";
import Text from "./text";
import Icon from "./icon";
import { globalStyles } from "@/src/constants/styles";

interface PopupProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showCloseButton?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

const Popup: React.FC<PopupProps> = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  contentStyle,
}) => {
  return (
    <View>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.content,
                  contentStyle,
                  { padding: theme.sizes.font },
                ]}
              >
                {(title || showCloseButton) && (
                  <View
                    style={[
                      globalStyles.row,
                      { justifyContent: "space-between", marginBottom: "8%" },
                    ]}
                  >
                    {showCloseButton && (
                      <Pressable onPress={onClose} style={globalStyles.row}>
                        <Icon
                          name="close-circle-outline"
                          size={24}
                          color={theme.colors.text}
                        />
                        <Text>Close</Text>
                      </Pressable>
                    )}

                    {title && (
                      <Text variant="h3" weight="bold">
                        {title}
                      </Text>
                    )}
                    <View />
                  </View>
                )}

                <View>{children}</View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    // padding: 20,
  },
  content: {
    width: "95%",
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    // borderTopLeftRadius: 24,
    // borderTopRightRadius: 24,
    overflow: "hidden",
  },
});

export default Popup;
