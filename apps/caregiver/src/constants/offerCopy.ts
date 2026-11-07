/** What the caregiver is told before declining a job. A decline is final (owner rule DP1-06: the server answers 403
 * "You declined this offer" if the caregiver tries to accept it afterwards), so say so before the tap, not after. */
export const DECLINE_TITLE = "Decline this job?";
export const DECLINE_MESSAGE = "It will be offered to other caregivers. You won't be able to accept it afterwards.";
