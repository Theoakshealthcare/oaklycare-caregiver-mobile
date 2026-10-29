import React, { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import ScreenShell from "@/src/components/account/ScreenShell";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import { Card, Chip, RiskBadge } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  NOT_REVIEWED_NOTE,
  ONLY_NURSES_HINT,
  ageAndSex,
  errorCode,
  listStatusLabel,
  matchesQuery,
  planLength,
} from "@/src/careplan/carePlanModel";
import { useDebounced } from "@/src/hooks/use-debounced";
import { useCaregiverHome } from "@/src/hooks/queries";
import { useAssignedPlans, usePlanTemplates } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import type { CarePlanListItem, CarePlanTemplateItem, PlanListStatus } from "@/src/services/carePlans.service";

type Props = StackScreenProps<ScreenParamLists, "CarePlans">;
type Tab = "assigned" | "templates";

const TabButton: React.FC<{ label: string; active: boolean; onPress: () => void; testID: string }> = ({ label, active, onPress, testID }) => (
  <Pressable
    testID={testID}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={{ flex: 1, alignItems: "center", paddingVertical: theme.spacing.sm, borderBottomWidth: 2, borderBottomColor: active ? theme.colors.primary : theme.colors.border }}
  >
    <Text variant="body" weight={active ? "bold" : "regular"} color={active ? theme.colors.primary : theme.colors.textLight}>
      {label}
    </Text>
  </Pressable>
);

const PlanCard: React.FC<{ plan: CarePlanListItem; onOpen: () => void; onProgress: () => void }> = ({ plan, onOpen, onProgress }) => {
  const subtitle = ageAndSex(plan.client);
  return (
    <Pressable testID={`plan-${plan.id}`} accessibilityRole="button" onPress={onOpen}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="bold">
              {plan.client.full_name}
            </Text>
            {subtitle ? (
              <Text variant="small" color={theme.colors.textLight}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Text variant="small" weight="medium" color={plan.status === "active" ? theme.colors.primary : theme.colors.textLight}>
            {listStatusLabel(plan.status)}
          </Text>
        </View>
        <Text variant="small">{plan.diagnosis}</Text>
        <RiskBadge risk={plan.risk_level} />
        {plan.progress_percent !== null && plan.progress_percent !== undefined ? (
          <View testID={`plan-progress-${plan.id}`} style={{ gap: theme.spacing.xs }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: "hidden" }}>
              <View style={{ width: `${Math.max(0, Math.min(100, plan.progress_percent))}%`, height: 6, backgroundColor: theme.colors.primary }} />
            </View>
            <Text variant="caption">{`${plan.progress_percent}% complete`}</Text>
          </View>
        ) : null}
        <Button testID={`plan-view-progress-${plan.id}`} title="View progress" variant="outline" onPress={onProgress} />
      </Card>
    </Pressable>
  );
};

const TemplateCard: React.FC<{ template: CarePlanTemplateItem; onOpen: () => void }> = ({ template, onOpen }) => (
  <Pressable testID={`template-${template.key}`} accessibilityRole="button" onPress={onOpen}>
    <Card>
      <Text variant="body" weight="bold">
        {template.name}
      </Text>
      <Text variant="small" color={theme.colors.textLight}>
        {template.summary}
      </Text>
      <Text variant="caption">
        {`${planLength(template.duration_days)}${template.review_every_days ? `, review every ${template.review_every_days} days` : ""}`}
      </Text>
      <RiskBadge risk={template.default_risk_level} />
      {template.clinical_review_status === "pending" ? (
        <Text variant="caption" color={theme.colors.warningText} testID={`template-pending-${template.key}`}>
          {NOT_REVIEWED_NOTE}
        </Text>
      ) : null}
    </Card>
  </Pressable>
);

/** The hub: Assigned / Templates, search, and "Create New Care Plan" (nurses). */
const CarePlans: React.FC<Props> = ({ route }) => {
  const { navigation } = useNavigation();
  const bookingId = route.params?.bookingId;
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? "assigned");
  const [status, setStatus] = useState<PlanListStatus>("active");
  const [search, setSearch] = useState("");
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
    const shown = templates.data.items.filter((t) => matchesQuery(t, search));
    if (shown.length === 0) {
      return <EmptyState icon="search" title="No templates match" hint="Try a different word." />;
    }
    return (
      <View style={{ gap: theme.spacing.md }}>
        {shown.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onOpen={() => navigation.navigate("CarePlanTemplate", { templateId: template.id, bookingId })}
          />
        ))}
      </View>
    );
  };

  const active = tab === "assigned" ? plans : templates;

  return (
    <ScreenShell
      title="Care plans"
      refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => void active.refetch()} />}
    >
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: "row" }}>
          <TabButton testID="tab-assigned" label="Assigned Care Plan" active={tab === "assigned"} onPress={() => switchTab("assigned")} />
          <TabButton testID="tab-templates" label="Templates" active={tab === "templates"} onPress={() => switchTab("templates")} />
        </View>

        <Input
          testID="plans-search"
          placeholder={tab === "assigned" ? "Search by client name" : "Search templates"}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          leftIcon={<Feather name="search" size={18} color={theme.colors.textLight} />}
        />

        {tab === "assigned" ? (
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <Chip testID="status-active" label="Active" selected={status === "active"} onPress={() => setStatus("active")} />
            <Chip testID="status-completed" label="Completed" selected={status === "completed"} onPress={() => setStatus("completed")} />
          </View>
        ) : null}

        {canAuthor ? <Button testID="create-new-plan" title="Create New Care Plan" onPress={create} /> : null}

        {tab === "assigned" ? assigned() : templateList()}
      </View>
    </ScreenShell>
  );
};

export default CarePlans;
