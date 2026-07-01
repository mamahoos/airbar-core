const IRAN_PHONE_REGEX = /^09\d{9}$/;
const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export function isIranianPhone(phone: string): boolean {
  return IRAN_PHONE_REGEX.test(phone) || phone.startsWith('+98');
}

export function isValidPhone(phone: string): boolean {
  return IRAN_PHONE_REGEX.test(phone) || E164_PHONE_REGEX.test(phone);
}

/** Normalize to canonical storage: Iran 09xxxxxxxxx, others +E.164 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim().replace(/\s/g, '');

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.startsWith('98')) {
      const national = digits.slice(2);
      if (national.length === 10 && national.startsWith('9')) {
        return `0${national}`;
      }
    }
    return `+${digits}`;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.startsWith('98') && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }

  if (digits.startsWith('09') && digits.length === 11) {
    return digits;
  }

  if (digits.startsWith('9') && digits.length === 10) {
    return `0${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return digits;
  }

  if (digits.length >= 7) {
    return `+${digits}`;
  }

  return trimmed;
}

export function assertValidPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) {
    throw new Error('Invalid phone number');
  }
  return normalized;
}
