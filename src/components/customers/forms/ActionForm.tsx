"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import type { CustomerDetailFormAction } from "./action-result";

type ActionFormProps = {
  action: CustomerDetailFormAction;
  className?: string;
  children: ReactNode;
};

/**
 * `<form>` que envía a una server action con firma useActionState y muestra
 * su error (clave i18n) en un `role="alert"` bajo los campos. Los redirects en
 * éxito los gestiona Next; `useFormStatus` en los hijos sigue funcionando.
 */
export default function ActionForm({ action, className, children }: ActionFormProps) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(action, null);
  const failure = state && !state.ok ? state : null;
  const fieldErrors = failure?.fieldErrors ? Object.entries(failure.fieldErrors) : [];

  return (
    <form action={formAction} className={className}>
      {children}
      {failure ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <p className="font-semibold">{t(failure.error)}</p>
          {fieldErrors.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {fieldErrors.map(([field, messageKey]) => (
                <li key={field}>{t(messageKey)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
