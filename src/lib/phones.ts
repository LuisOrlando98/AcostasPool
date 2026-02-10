export function normalizeUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let core = digits;

  if (digits.length === 11 && digits.startsWith("1")) {
    core = digits.slice(1);
  }

  if (core.length !== 10) {
    return null;
  }

  return `+1 (${core.slice(0, 3)})-${core.slice(3, 6)}-${core.slice(6)}`;
}

export function formatUsPhone(input?: string | null): string | null {
  if (!input) {
    return null;
  }
  return normalizeUsPhone(input) ?? input;
}
