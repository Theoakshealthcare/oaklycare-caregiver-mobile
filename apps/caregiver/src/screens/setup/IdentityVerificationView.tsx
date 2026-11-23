import React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import StepIndicator, { ONBOARDING_STEP } from "@/src/components/ui/step-indicator";
import HeaderBack from "@/src/components/back/HeaderBack";
import ConsentBlock from "@/src/components/identity/ConsentBlock";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { globalStyles, FORM_PADDING } from "@/src/constants/styles";
import FieldLabel from "@/src/components/ui/field-label";
import { theme } from "@/src/constants/theme";
import {
  STILL_CHECKING_TEXT,
  asksConsent,
  attemptLabel,
  canDefer,
  reviewEtaText,
  tipFor,
  type IdentityScreen,
  type IdentityState,
} from "@/src/identity/identityModel";

/**
 * Everything the identity step can show (design 11.3). Presentational: it gets the screen to draw, the server
 * state and callbacks, so it holds no provider type and makes no request. `onStart` is "start (or resume) a
 * verification"; what opens behind it is the container's business.
 */
export interface IdentityViewProps {
  screen: IdentityScreen;
  state?: IdentityState;
  /** The load error, for the generic failure message. */
  errorMessage?: string | null;
  /** A refused start, shown above the screen underneath. */
  banner?: string | null;
  consentChecked: boolean;
  onToggleConsent: () => void;
  /** One minute of waiting / five minutes and polling stopped. */
  slow?: boolean;
  stopped?: boolean;
  /** The browser was dismissed before the return page and the server has not heard "completed". */
  canContinueVerification?: boolean;
  onContinueVerification?: () => void;
  onStart: () => void;
  onContinue: () => void;
  onDefer: () => void;
  deferring?: boolean;
  onReload: () => void;
  onCheckAgain: () => void;
  onOpenSettings: () => void;
  onContactSupport: () => void;
}

const Panel: React.FC<{
  testID: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
  tone?: "primary" | "success" | "error";
  title: string;
  children?: React.ReactNode;
}> = ({ testID, icon, tone = "primary", title, children }) => {
  const color = tone === "success" ? theme.colors.success : tone === "error" ? theme.colors.error : theme.colors.primary;
  return (
    <View testID={testID} style={{ gap: 16, alignItems: "center", paddingVertical: 24 }}>
      {icon ? <Feather name={icon} size={56} color={color} /> : null}
      <Text variant="h2" weight="bold" center color={tone === "error" ? theme.colors.error : undefined}>
        {title}
      </Text>
      {children}
    </View>
  );
};

const Body: React.FC<{ children: React.ReactNode; testID?: string }> = ({ children, testID }) => (
  <Text testID={testID} variant="body" color={theme.colors.textLight} center style={{ lineHeight: 24 }}>
    {children}
  </Text>
);

/** The two rows of the Figma identity step. Both open the same hosted check, which takes the ID photo and then the live selfie. */
export const SCAN_ID_LABEL = "Scan identification";
export const SCAN_ID_PLACEHOLDER = "National ID, Passport, or Driver’s License";
export const FACE_SCAN_LABEL = "Face Scan Verification";
export const FACE_SCAN_PLACEHOLDER = "Turn on your Camera";

const ChooserRow: React.FC<{ testID: string; label: string; placeholder: string; disabled: boolean; onPress: () => void }> = ({
  testID,
  label,
  placeholder,
  disabled,
  onPress,
}) => (
  <View>
    <FieldLabel>{label}</FieldLabel>
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${placeholder}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: 16,
        paddingHorizontal: theme.spacing.md,
        minHeight: 48,
        paddingVertical: 12,
      }}
    >
      <Text variant="body" color={theme.colors.textLight} style={{ flexShrink: 1 }}>
        {placeholder}
      </Text>
      <Feather name="chevron-right" size={20} color={theme.colors.text} />
    </Pressable>
  </View>
);

const IdentityVerificationView: React.FC<IdentityViewProps> = (props) => {
  const { screen, state, consentChecked, onToggleConsent, onStart, onContinue } = props;
  const newAttempt = asksConsent(screen);

  // Both rows start (or resume) the same verification; a new attempt needs the explicit consent below them first.
  const chooser = (
    <View style={{ gap: 18 }}>
      <ChooserRow
        testID="identity-start"
        label={SCAN_ID_LABEL}
        placeholder={SCAN_ID_PLACEHOLDER}
        disabled={newAttempt && !consentChecked}
        onPress={onStart}
      />
      <ChooserRow
        testID="identity-start-face"
        label={FACE_SCAN_LABEL}
        placeholder={FACE_SCAN_PLACEHOLDER}
        disabled={newAttempt && !consentChecked}
        onPress={onStart}
      />
    </View>
  );

  const startButton = (title: string) => (
    <Button
      testID="identity-start"
      title={title}
      onPress={onStart}
      disabled={newAttempt && !consentChecked}
      style={{ alignSelf: "stretch" }}
    />
  );

  const content = (() => {
    switch (screen) {
      case "loading":
        return <ActivityIndicator testID="identity-loading" style={{ marginTop: 40 }} size="large" color={theme.colors.primary} />;

      case "loadError":
        return (
          <Panel testID="identity-load-error" icon="alert-circle" tone="error" title="We couldn't load this">
            <Body>{props.errorMessage ?? "Something went wrong. Please try again."}</Body>
            <Button title="Try again" onPress={props.onReload} style={{ alignSelf: "stretch" }} />
          </Panel>
        );

      case "offline":
        return (
          <Panel testID="identity-offline" icon="wifi-off" title="You're offline">
            <Body>Connect to the internet to check your identity. Your progress is saved.</Body>
            <Button title="Try again" onPress={props.onReload} style={{ alignSelf: "stretch" }} />
          </Panel>
        );

      case "intro":
      case "tryAgain":
      case "expired":
      case "error":
        return (
          <View testID={`identity-${screen}`} style={{ gap: 24 }}>
            {screen === "tryAgain" && state ? (
              <View testID="identity-try-again" style={{ gap: 8, padding: 16, borderRadius: 12, backgroundColor: theme.colors.soft }}>
                <Text variant="body" weight="bold">
                  We couldn&apos;t confirm your identity
                </Text>
                <Text testID="identity-tip" variant="body" color={theme.colors.textLight}>
                  {tipFor(state.failure_hint)}
                </Text>
                <Text testID="identity-attempt" variant="small" color={theme.colors.textLight}>
                  {attemptLabel(state, screen)}
                </Text>
              </View>
            ) : null}
            {screen === "expired" ? (
              <View testID="identity-expired-note" style={{ gap: 4, padding: 16, borderRadius: 12, backgroundColor: theme.colors.soft }}>
                <Text variant="body" weight="bold">
                  That session timed out
                </Text>
                <Text variant="body" color={theme.colors.textLight}>
                  It didn&apos;t use up an attempt. Start again when you&apos;re ready.
                </Text>
              </View>
            ) : null}
            {screen === "error" ? (
              <View testID="identity-check-error" style={{ gap: 4, padding: 16, borderRadius: 12, backgroundColor: theme.colors.soft }}>
                <Text variant="body" weight="bold">
                  We couldn&apos;t complete the check
                </Text>
                <Text variant="body" color={theme.colors.textLight}>
                  Something went wrong on our side. It didn&apos;t use up an attempt.
                </Text>
              </View>
            ) : null}
            {chooser}
            <ConsentBlock checked={consentChecked} onToggle={onToggleConsent} />
            {/* Grey until the check is done, as in Figma; the result screens below carry the live Continue. */}
            <Button testID="identity-save" title="Save & Continue" onPress={() => undefined} disabled style={{ alignSelf: "stretch" }} />
          </View>
        );

      case "resume":
        return (
          <View testID="identity-resume" style={{ gap: 24 }}>
            <Body>You&apos;ve already agreed to this identity check. Pick up where you left off.</Body>
            {chooser}
            {state ? (
              <Text testID="identity-attempt" variant="small" color={theme.colors.textLight}>
                {attemptLabel(state, screen)}
              </Text>
            ) : null}
            <Button testID="identity-save" title="Save & Continue" onPress={() => undefined} disabled style={{ alignSelf: "stretch" }} />
          </View>
        );

      case "starting":
        return (
          <Panel testID="identity-starting" title="Opening verification...">
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </Panel>
        );

      case "widget":
        return (
          <Panel testID="identity-widget" icon="camera" title="Verification is open">
            <Body>Finish the steps in the verification window. When you&apos;re done you&apos;ll come back here.</Body>
          </Panel>
        );

      case "permissionDenied":
        return (
          <Panel testID="identity-permission-denied" icon="camera-off" title="Camera access is needed">
            <Body>
              We use your camera to take a live photo and compare it with your ID. Turn on camera access for Oakly in Settings, then
              try again.
            </Body>
            <Button title="Open Settings" onPress={props.onOpenSettings} style={{ alignSelf: "stretch" }} />
            <Button title="Try again" variant="outline" onPress={onStart} style={{ alignSelf: "stretch" }} />
          </Panel>
        );

      case "closed":
        return (
          <Panel testID="identity-closed" icon="x-circle" title="You closed verification before finishing">
            <Body>That didn&apos;t use up an attempt. You can pick it up again whenever you&apos;re ready.</Body>
            {startButton("Try again")}
          </Panel>
        );

      case "widgetError":
        return (
          <Panel testID="identity-widget-error" icon="alert-circle" tone="error" title="Something went wrong">
            <Body>The verification window had a problem. That didn&apos;t use up an attempt.</Body>
            {startButton("Try again")}
          </Panel>
        );

      case "checking":
        return (
          <Panel testID="identity-checking" title="Checking your details...">
            <ActivityIndicator size="large" color={theme.colors.primary} />
            {state ? (
              <Text testID="identity-attempt" variant="small" color={theme.colors.textLight}>
                {attemptLabel(state, screen)}
              </Text>
            ) : null}
            {props.slow ? (
              <Body testID="identity-slow">{STILL_CHECKING_TEXT}</Body>
            ) : (
              <Body>This usually takes about a minute.</Body>
            )}
            {props.canContinueVerification ? (
              <>
                <Body testID="identity-dismissed-note">If you didn&apos;t finish in the verification window, you can open it again.</Body>
                <Button
                  testID="identity-continue-verification"
                  title="Continue verification"
                  variant="outline"
                  onPress={props.onContinueVerification}
                  style={{ alignSelf: "stretch" }}
                />
              </>
            ) : null}
            {props.stopped ? (
              <Button testID="identity-check-again" title="Check again" variant="outline" onPress={props.onCheckAgain} style={{ alignSelf: "stretch" }} />
            ) : null}
          </Panel>
        );

      case "verified":
        return (
          <Panel testID="identity-verified" icon="check-circle" tone="success" title="Identity verified">
            <Body>Thank you. Your identity check is complete.</Body>
            <Button testID="identity-continue" title="Continue" onPress={onContinue} style={{ alignSelf: "stretch" }} />
          </Panel>
        );

      case "exhausted":
        return (
          <Panel testID="identity-exhausted" icon="info" title="You've used all your attempts">
            <Body>Our team will review your case. You can continue with your application.</Body>
            <Button testID="identity-continue" title="Continue" onPress={onContinue} style={{ alignSelf: "stretch" }} />
          </Panel>
        );

      case "underReview":
        // No reason is ever shown for a review (a duplicate or a watch-list hit must not be revealed).
        return (
          <Panel testID="identity-under-review" icon="clock" title="Under review">
            <Body>
              A person on our team will check this, {reviewEtaText(state?.review_eta_hours)}. You can continue.
            </Body>
            <Button testID="identity-continue" title="Continue" onPress={onContinue} style={{ alignSelf: "stretch" }} />
          </Panel>
        );

      case "unavailable":
        return (
          <Panel testID="identity-unavailable" icon="cloud-off" title="Verification is temporarily unavailable">
            <Body>Your progress is saved. You&apos;ll be asked to verify your identity later, and you can&apos;t be approved until you have.</Body>
            {canDefer(state) ? (
              <Button
                testID="identity-defer"
                title="Continue without for now"
                onPress={props.onDefer}
                loading={props.deferring}
                style={{ alignSelf: "stretch" }}
              />
            ) : null}
            <Button title="Check again" variant="outline" onPress={props.onReload} style={{ alignSelf: "stretch" }} />
          </Panel>
        );

      case "rejected":
        return (
          <Panel testID="identity-rejected" icon="x-circle" tone="error" title="We couldn't confirm your identity">
            <Body>Our team couldn&apos;t confirm your identity. Please contact Oakly support if you think this is a mistake.</Body>
            <Button title="Contact support" onPress={props.onContactSupport} style={{ alignSelf: "stretch" }} />
          </Panel>
        );

      case "updateRequired":
        return (
          <Panel testID="identity-update-required" icon="download" title="Update the app to continue">
            <Body>The identity check has changed. Please update Oakly to the latest version, then come back to this step.</Body>
          </Panel>
        );
    }
  })();

  // Offered next to the outage and while waiting, when the provider is flagged down mid-check.
  const deferBesideChecking = screen === "checking" && canDefer(state);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[globalStyles.container, FORM_PADDING, { gap: 8, paddingTop: 16 }]}>
          <HeaderBack />
          <View style={{ marginTop: 14 }}>
            <Text variant="page" weight="bold">
              Set up your Account
            </Text>
            <StepIndicator step={ONBOARDING_STEP.identity} />
          </View>
          <Text variant="h3" weight="bold" style={{ marginTop: 6, marginBottom: 6 }}>
            Identity Verification
          </Text>
          {props.banner ? (
            <View testID="identity-banner" style={{ padding: 14, borderRadius: 12, backgroundColor: theme.colors.warning + "33" }}>
              <Text variant="body" color={theme.colors.warningText}>
                {props.banner}
              </Text>
            </View>
          ) : null}
          {content}
          {deferBesideChecking ? (
            <Button
              testID="identity-defer"
              title="Continue without for now"
              variant="outline"
              onPress={props.onDefer}
              loading={props.deferring}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

export default IdentityVerificationView;
