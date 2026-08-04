"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  action: (formData: FormData) => Promise<{ error?: string } | undefined>;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  className: string;
};

export default function InlineActionButton({ action, fields, label, pendingLabel, className }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }
    const result = await action(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div>
      <button type="button" disabled={pending} onClick={run} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {error ? <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}
