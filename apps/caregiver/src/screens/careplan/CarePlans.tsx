import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useNavigationState } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import { Chip, RoundBack } from "@/src/components/careplan/parts";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  NOT_REVIEWED_NOTE,
  ONLY_NURSES_HINT,
  errorCode,
  listStatusLabel,
  riskLabel,
} from "@/src/careplan/carePlanModel";
import { useDebounced } from "@/src/hooks/use-debounced";
import { useCaregiverHome } from "@/src/hooks/queries";
import { useAssignedPlans, usePlanTemplates } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import type { CarePlanListItem, CarePlanTemplateItem, PlanListStatus } from "@/src/services/carePlans.service";

type Props = StackScreenProps<ScreenParamLists, "CarePlans">;
type Tab = "assigned" | "templates";

/** The pill switch in the teal header: the chosen tab is a filled teal pill on a white track. */
const TabButton: React.FC<{ label: string; active: boolean; onPress: () => void; testID: string }> = ({ label, active, onPress, testID }) => (
  <Pressable
    testID={testID}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={{
      flex: 1,
      alignItems: "center",
      paddingVertical: theme.spacing.sm + 2,
      borderRadius: theme.borderRadius.round,
      backgroundColor: active ? theme.colors.primary : "transparent",
    }}
  >
    <Text variant="small" weight={active ? "bold" : "regular"} color={active ? theme.colors.white : theme.colors.textLight} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

const WhiteCard: React.FC<{ children: React.ReactNode; testID?: string }> = ({ children, testID }) => (
  <View testID={testID} style={{ backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.sm }}>
    {children}
  </View>
);

const RISK_TEXT: Record<CarePlanListItem["risk_level"], string> = {
  high: theme.colors.secondary,
  medium: theme.colors.warning,
  low: theme.colors.toast,
};

const SmallPill: React.FC<{ label: string; onPress: () => void; testID: string; filled?: boolean }> = ({ label, onPress, testID, filled }) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    onPress={onPress}
    style={{
      paddingVertical: theme.spacing.xs + 2,
      paddingHorizontal: theme.spacing.sm + 2,
      borderRadius: theme.borderRadius.round,
      backgroundColor: filled ? theme.colors.primary : theme.colors.primaryLight,
    }}
  >
    <Text variant="caption" weight="medium" color={filled ? theme.colors.white : theme.colors.primary}>
      {label}
    </Text>
  </Pressable>
);

const PlanCard: React.FC<{ plan: CarePlanListItem; onOpen: () => void; onProgress: () => void }> = ({ plan, onOpen, onProgress }) => {
  const detail = [`Primary Diagnosis: ${plan.diagnosis}`, plan.client.age != null ? `Age: ${plan.client.age}` : null].filter(Boolean).join(" | ");
  const done = plan.status !== "active";
  const statusColour = done ? theme.colors.toast : theme.colors.warning;
  return (
    <Pressable testID={`plan-${plan.id}`} accessibilityRole="button" onPress={onOpen}>
      <WhiteCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: theme.spacing.sm }}>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="body" weight="bold">
              {`Assigned Plan: ${plan.client.full_name}`}
            </Text>
            <Text variant="small" color={theme.colors.textLight}>
              {detail}
            </Text>
            <Text variant="small" weight="bold" color={RISK_TEXT[plan.risk_level]} testID={`plan-risk-${plan.id}`}>
              {`Risk: ${riskLabel(plan.risk_level)}`}
            </Text>
          </View>
          <SmallPill testID={`plan-view-progress-${plan.id}`} label="View Progress" filled onPress={onProgress} />
        </View>
        <Text variant="caption" color={theme.colors.textLight} testID={`plan-status-${plan.id}`}>
          {"Status: "}
          <Text variant="caption" weight="medium" color={statusColour}>
            {listStatusLabel(plan.status)}
          </Text>
        </Text>
        {plan.progress_percent !== null && plan.progress_percent !== undefined ? (
          <View testID={`plan-progress-${plan.id}`} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
            <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, overflow: "hidden" }}>
              <View style={{ width: `${Math.max(0, Math.min(100, plan.progress_percent))}%`, height: 5, backgroundColor: statusColour }} />
            </View>
            <Text variant="caption" color={theme.colors.textLight}>{`${plan.progress_percent}%`}</Text>
          </View>
        ) : null}
      </WhiteCard>
    </Pressable>
  );
};

const TemplateCard: React.FC<{ template: CarePlanTemplateItem; onPreview: () => void; onUse: () => void }> = ({ template, onPreview, onUse }) => (
  <WhiteCard testID={`template-${template.key}`}>
    <Text variant="body" weight="bold">
      {template.name}
    </Text>
    <Text variant="small" color={theme.colors.textLight}>
      {template.summary}
    </Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
      <Feather name="clock" size={14} color={theme.colors.primary} />
      <Text variant="caption" color={theme.colors.primary}>
        {`${template.duration_days}-day Program`}
      </Text>
    </View>
    {template.clinical_review_status === "pending" ? (
      <Text variant="caption" color={theme.colors.warningText} testID={`template-pending-${template.key}`}>
        {NOT_REVIEWED_NOTE}
      </Text>
    ) : null}
    <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
      <SmallPill testID={`template-preview-${template.key}`} label="Preview Template" onPress={onPreview} />
      <SmallPill testID={`template-use-${template.key}`} label="Use Template" filled onPress={onUse} />
    </View>
  </WhiteCard>
);

/** The hub: Assigned / Templates, search, and "Create New Care Plan" (nurses). */
const CarePlans: React.FC<Props> = ({ route }) => {
  const { navigation } = useNavigation();
  const bookingId = route.params?.bookingId;
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? "assigned");
  const [status, setStatus] = useState<PlanListStatus>("active");
  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState("");
  const hasHistory = useNavigationState((state) => state.index > 0);
  const query = useDebounced(search.trim(), 300);

  // The server decides who can author; the app never reads the nurse skill (it is not in any response).
  const canAuthor = useCaregiverHome().data?.can_author_care_plans === true;
  const plans = useAssignedPlans(status, query, tab === "assigned");
  const templates = usePlanTemplates(tab === "templates");

  // One search box serves both tabs; a client name typed on Assigned must not filter the templates.
  const switchTab = (next: Tab) => {
    setTab(next);
    setSearch("");
  };

  const create = () =>
    bookingId ? navigation.navigate("CreateCarePlan", { bookingId }) : navigation.navigate("CarePlanClients", {});

  const assigned = () => {
    if (plans.isError && !plans.data) return <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />;
    if (!plans.data) return <LoadingState testID="plans-loading" />;
    if (plans.data.items.length === 0) {
      return query ? (
        <EmptyState icon="search" title="No plans match" hint="Check the spelling of the client's name." />
      ) : (
        <EmptyState
          icon="clipboard"
          title={status === "active" ? "No active care plans" : "No completed care plans"}
          hint={canAuthor && status === "active" ? "Create one for a client you are visiting." : "Plans for your current clients appear here."}
        />
      );
    }
    return (
      <View style={{ gap: theme.spacing.md }}>
        {plans.data.items.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onOpen={() => navigation.navigate("CarePlanDetails", { planId: plan.id })}
            onProgress={() => navigation.navigate("CarePlanProgress", { planId: plan.id, clientName: plan.client.full_name })}
          />
        ))}
      </View>
    );
  };

  const templateList = () => {
    if (templates.isError && !templates.data) {
      return errorCode(templates.error) === "not_a_nurse" ? (
        <EmptyState icon="lock" title="Templates are for nurses" hint={ONLY_NURSES_HINT} />
      ) : (
        <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
      );
    }
    if (!templates.data) return <LoadingState testID="templates-loading" />;
    if (templates.data.items.length === 0) {
      return <EmptyState icon="clipboard" title="No templates yet" hint="Templates appear here when they are published." />;
    }
    return (
      <View style={{ gap: theme.spacing.md }}>
        {templates.data.items.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onPreview={() => navigation.navigate("CarePlanTemplate", { templateId: template.id, bookingId })}
            onUse={() =>
              bookingId
                ? navigation.navigate("CreateCarePlan", { bookingId, templateId: template.id })
                : navigation.navigate("CarePlanClients", { templateId: template.id })
            }
          />
        ))}
      </View>
    );
  };

  const active = tab === "assigned" ? plans : templates;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.careBackground }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => void active.refetch()} />}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
      >
        <View
          style={{
            backgroundColor: theme.colors.primary,
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm + 4,
            paddingBottom: theme.spacing.md,
            borderBottomLeftRadius: theme.borderRadius.xxl + 8,
            borderBottomRightRadius: theme.borderRadius.xxl + 8,
            gap: theme.spacing.md,
          }}
        >
          <View style={{ alignSelf: "flex-start" }}>{hasHistory ? <RoundBack light onPress={() => navigation.goBack()} /> : null}</View>
          <Text variant="h2" weight="bold" color={theme.colors.white} accessibilityRole="header">
            Careplan System
          </Text>
          {canAuthor ? (
            <Pressable
              testID="create-new-plan"
              accessibilityRole="button"
              accessibilityLabel="Create New Care Plan"
              onPress={create}
              style={{ alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}
            >
              <Feather name="plus" size={18} color={theme.colors.white} />
              <Text variant="small" weight="medium" color={theme.colors.white}>
                Create New Care Plan
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: "row", backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.round, padding: theme.spacing.xs }}>
            <TabButton testID="tab-assigned" label="Assigned Care Plan" active={tab === "assigned"} onPress={() => switchTab("assigned")} />
            <TabButton testID="tab-templates" label="Care Plan Templates" active={tab === "templates"} onPress={() => switchTab("templates")} />
          </View>
        </View>

        <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          {tab === "assigned" ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                <Input
                  testID="plans-search"
                  placeholder="Search Plan"
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  backgroundColor={theme.colors.primaryLight}
                  leftIcon={<Feather name="search" size={18} color={theme.colors.textLight} />}
                  containerStyle={{ flex: 1 }}
                />
                <Pressable
                  testID="plans-filter"
                  accessibilityRole="button"
                  accessibilityLabel="Filter plans"
                  accessibilityState={{ expanded: showFilter }}
                  onPress={() => setShowFilter((v) => !v)}
                  style={{ width: 48, height: 48, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}
                >
                  <Feather name="sliders" size={20} color={theme.colors.white} />
                </Pressable>
              </View>
              {showFilter ? (
                <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                  <Chip testID="status-active" label="Active" selected={status === "active"} onPress={() => setStatus("active")} />
                  <Chip testID="status-completed" label="Completed" selected={status === "completed"} onPress={() => setStatus("completed")} />
                </View>
              ) : null}
            </>
          ) : null}

          {tab === "assigned" ? assigned() : templateList()}
        </View>
      </ScrollView>
    </View>
  );
};

export default CarePlans;
