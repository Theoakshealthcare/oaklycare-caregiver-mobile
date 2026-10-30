/**
 * Whether the in-app Call screen can be reached. Off: the screen is a mock (no audio or video, no real call), and
 * showing it to a caregiver would promise something the app cannot do. Hidden until masked calling exists (the
 * caregiver and patient must not see each other's numbers). Turn on by setting this to `true`: the chat header shows
 * the phone and video buttons again and the `CallScreen` route is registered. The screen file is kept as it was.
 */
export const CALLING_ENABLED = false;
