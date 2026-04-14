export function withFeedbackParam(path: string, feedback: string) {
  const [pathWithoutHash, hash = ""] = path.split("#", 2);
  const [pathname, queryString = ""] = pathWithoutHash.split("?", 2);
  const params = new URLSearchParams(queryString);

  params.set("feedback", feedback);

  const nextQuery = params.toString();

  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}

export function resolveSafeReturnTo(
  input: FormDataEntryValue | null,
  fallbackPath: string,
  allowedPrefixes: string[]
) {
  if (typeof input !== "string") {
    return fallbackPath;
  }

  const trimmed = input.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallbackPath;
  }

  return allowedPrefixes.some((prefix) => trimmed.startsWith(prefix))
    ? trimmed
    : fallbackPath;
}
