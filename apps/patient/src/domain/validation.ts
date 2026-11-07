/** Loose on purpose: the server has the last word, this only catches a typo before the round trip. */
export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export const MIN_PASSWORD_LENGTH = 8;

/** The app asks for 8 characters; the backend sets no minimum of its own today. */
export function passwordProblem(password: string): string | undefined {
  if (!password) return "Password is required";
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  return undefined;
}
