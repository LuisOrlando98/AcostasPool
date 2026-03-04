const PATH_SEGMENT_PATTERN = /[^a-zA-Z0-9 _.-]/g;

function sanitizeSegment(value: string, fallback: string) {
  const normalized = value.trim().replace(PATH_SEGMENT_PATTERN, "_");
  return normalized || fallback;
}

export function buildCustomerRepositoryRoot(customerId: string) {
  const safeCustomerId = sanitizeSegment(customerId, "customer");
  return `uploads/customers/${safeCustomerId}/repository/`;
}

export function sanitizeRepositoryPath(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!normalized || normalized === ".") {
    return "";
  }
  if (normalized.includes("..")) {
    return "";
  }
  return normalized
    .split("/")
    .map((segment) => sanitizeSegment(segment, "item"))
    .join("/");
}

export function sanitizeRepositoryName(value: string, fallback = "item") {
  return sanitizeSegment(value, fallback);
}

export function splitRepositoryParent(path: string) {
  const clean = sanitizeRepositoryPath(path);
  if (!clean) {
    return { parent: "", name: "" };
  }
  const parts = clean.split("/");
  const name = parts.pop() ?? "";
  return {
    parent: parts.join("/"),
    name,
  };
}

export function removePrefix(value: string, prefix: string) {
  if (!value.startsWith(prefix)) {
    return null;
  }
  return value.slice(prefix.length);
}
