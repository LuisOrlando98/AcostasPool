"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type ConfirmState = {
  message: string;
  options?: ConfirmOptions;
};

/**
 * In-app replacement for window.confirm(): await confirm(message) resolves
 * to true/false once the admin picks an option in the rendered dialog.
 * Render the returned ConfirmDialog once, anywhere in the component tree.
 */
export function useConfirm() {
  const { t } = useI18n();
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ message, options });
    });
  }, []);

  const resolve = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(null);
  };

  useEffect(() => {
    if (!state) {
      return;
    }
    const unlock = lockBodyScroll();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resolve(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      unlock();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [state]);

  const ConfirmDialog =
    typeof document !== "undefined" && state
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[3000] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              onClick={() => resolve(false)}
              aria-label={state.options?.cancelLabel ?? t("common.actions.cancel")}
            />
            <div
              role="alertdialog"
              aria-modal="true"
              className="app-modal-card relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="p-5 sm:p-6">
                {state.options?.title ? (
                  <h3 className="text-base font-semibold text-slate-900">{state.options.title}</h3>
                ) : null}
                <p className="mt-1 text-sm text-slate-600">{state.message}</p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => resolve(false)}
                    className="app-button-ghost px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                  >
                    {state.options?.cancelLabel ?? t("common.actions.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve(true)}
                    className={
                      state.options?.tone === "danger"
                        ? "rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-rose-700"
                        : "app-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                    }
                  >
                    {state.options?.confirmLabel ?? t("common.actions.confirm")}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return { confirm, ConfirmDialog };
}
