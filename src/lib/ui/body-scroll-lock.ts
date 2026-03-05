"use client";

const LOCK_COUNT_ATTR = "data-ap-scroll-lock-count";
const PREV_OVERFLOW_ATTR = "data-ap-scroll-lock-prev-overflow";

function getLockCount(body: HTMLBodyElement) {
  const raw = body.getAttribute(LOCK_COUNT_ATTR);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function lockBodyScroll() {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  const body = document.body;
  const currentCount = getLockCount(body);
  if (currentCount === 0) {
    body.setAttribute(PREV_OVERFLOW_ATTR, body.style.overflow || "");
    body.style.overflow = "hidden";
  }

  body.setAttribute(LOCK_COUNT_ATTR, String(currentCount + 1));

  return () => {
    const nextCount = Math.max(0, getLockCount(body) - 1);
    if (nextCount === 0) {
      const previousOverflow = body.getAttribute(PREV_OVERFLOW_ATTR) ?? "";
      body.style.overflow = previousOverflow;
      body.removeAttribute(LOCK_COUNT_ATTR);
      body.removeAttribute(PREV_OVERFLOW_ATTR);
      return;
    }
    body.setAttribute(LOCK_COUNT_ATTR, String(nextCount));
  };
}
