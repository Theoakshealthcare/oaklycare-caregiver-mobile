import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/**
 * Whether the caregiver has changed anything on their profile since the admin asked for changes.
 *
 * The verification status says WHICH items were requested only as free text (`changes_requested.items` is a list of
 * sentences such as "Upload a clearer licence photo"), so the app cannot tell which one a given edit answers. The
 * rule it can keep is the weaker one: "Resubmit for review" stays disabled until at least one profile or document
 * write has succeeded in this session. It is held in memory on purpose: it ends with the session (sign-out clears
 * it, see `src/auth`) and with a successful resubmit, so a second request starts from "nothing changed yet".
 * TODO: have the backend refuse the resubmit itself (a 409 naming the untouched items), which this cannot replace.
 */
const store = createStore<{ edited: boolean }>(() => ({ edited: false }));

/** Called after a profile step or a document upload succeeded. */
export function markProfileEdited(): void {
  store.setState({ edited: true });
}

/** Called after a resubmit and on sign-out. */
export function resetProfileEdited(): void {
  store.setState({ edited: false });
}

export function hasEditedProfile(): boolean {
  return store.getState().edited;
}

export function useHasEditedProfile(): boolean {
  return useStore(store, (state) => state.edited);
}

/** The helper line under the disabled "Resubmit for review" button. */
export const RESUBMIT_HINT = "Update the item we asked for, then resubmit.";
