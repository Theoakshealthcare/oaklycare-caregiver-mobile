import { CommonActions, type NavigationState, type PartialState } from "@react-navigation/native";

/** The screens that only exist to get a plan created. Once the plan exists, Back must not return to them. */
const CREATION_FLOW = new Set(["CarePlanClients", "CarePlanTemplate", "CreateCarePlan", "CarePlanSuccess"]);

type Route = { name: string; params?: object; key?: string };

/**
 * The stack after a plan is created: the creation screens (client picker, template preview, the form
 * and the success page) are dropped and the new plan opens on top of whatever was underneath, normally
 * the care plans hub. Back from the plan then lands on the hub, not on a stale "Choose a client" (DP1-26).
 */
export function routesAfterPlanCreated(routes: Route[], planId: string): Route[] {
  const kept = routes.filter((route) => !CREATION_FLOW.has(route.name));
  return [...kept, { name: "CarePlanDetails", params: { planId } }];
}

/** A navigation action that applies {@link routesAfterPlanCreated} to the current stack. */
export function openCreatedPlan(planId: string) {
  return (state: NavigationState | PartialState<NavigationState>) => {
    const routes = routesAfterPlanCreated(state.routes as Route[], planId);
    return CommonActions.reset({ routes, index: routes.length - 1 } as Parameters<typeof CommonActions.reset>[0]);
  };
}
