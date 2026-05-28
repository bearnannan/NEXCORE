export const PHONE_DIGIT_LENGTH = 10;
export const PHONE_PATTERN = /^\d{3}-\d{3}-\d{4}$/;

export function phoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, PHONE_DIGIT_LENGTH);
}

export function formatIncidentPhone(value: string) {
  const digits = phoneDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidIncidentPhone(value: string) {
  const formatted = formatIncidentPhone(value);
  return phoneDigits(formatted).length === PHONE_DIGIT_LENGTH && PHONE_PATTERN.test(formatted);
}

export function normalizeIncidentPhone(value: string) {
  return formatIncidentPhone(value);
}

export function invalidPhoneMessage(label: string) {
  return `${label} must be a valid 10-digit phone number, for example 081-234-5678.`;
}
