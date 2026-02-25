const DEFAULT_DEVELOPER_EMAILS = [
  "luiso.rodriguezcabrera@gmail.com",
] as const;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getDeveloperEmails() {
  return DEFAULT_DEVELOPER_EMAILS.map((value) => normalizeEmail(value));
}

export function isDeveloperEmail(email?: string | null) {
  if (!email) {
    return false;
  }
  const normalized = normalizeEmail(email);
  return getDeveloperEmails().includes(normalized);
}

export function isDeveloperAccount(input: {
  email?: string | null;
  isDeveloper?: boolean | null;
}) {
  return Boolean(input.isDeveloper) && isDeveloperEmail(input.email);
}
