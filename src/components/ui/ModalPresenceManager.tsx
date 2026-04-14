"use client";

import { useEffect } from "react";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

function hasVisibleModal() {
  if (typeof document === "undefined") {
    return false;
  }

  return Array.from(document.querySelectorAll<HTMLElement>(".app-modal-layer")).some(
    (element) => {
      const style = window.getComputedStyle(element);

      return style.display !== "none" && style.visibility !== "hidden";
    }
  );
}

export default function ModalPresenceManager() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    let unlock: (() => void) | null = null;
    let frame = 0;

    const update = () => {
      const shouldLock = hasVisibleModal();

      document.documentElement.toggleAttribute("data-app-modal-open", shouldLock);

      if (shouldLock && !unlock) {
        unlock = lockBodyScroll();
        return;
      }

      if (!shouldLock && unlock) {
        unlock();
        unlock = null;
      }
    };

    const scheduleUpdate = () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "style", "hidden", "open", "aria-hidden"],
    });

    document.addEventListener("change", scheduleUpdate, true);
    document.addEventListener("click", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);

    update();

    return () => {
      observer.disconnect();
      document.removeEventListener("change", scheduleUpdate, true);
      document.removeEventListener("click", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) {
        cancelAnimationFrame(frame);
      }
      if (unlock) {
        unlock();
      }
      document.documentElement.removeAttribute("data-app-modal-open");
    };
  }, []);

  return null;
}
