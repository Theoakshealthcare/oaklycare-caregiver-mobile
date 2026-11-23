/** The decline dialog, in the Figma words (the typo "this Bookings" is not copied). A decline is final (owner rule DP1-06:
 * the server answers 403 "You declined this offer" if the caregiver tries to accept it afterwards), so the dialog also
 * says so before the tap, not after. */
export const DECLINE_TITLE = "Are you sure you want to decline this booking ?";
export const DECLINE_MESSAGE = "Once you decline this booking, you won't have access to a patient.";
export const DECLINE_FINAL_NOTICE = "It will be offered to other caregivers. You won't be able to accept it afterwards.";
export const DECLINE_CANCEL = "No, Go Back";
export const DECLINE_CONFIRM = "Yes, Decline";
