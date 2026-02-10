export const getAssetUrl = (path?: string | null) => {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = process.env.NEXT_PUBLIC_CDN_URL;
  if (!base) {
    return path;
  }
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${suffix}`;
};
