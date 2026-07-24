"use client";

import { useState, type FormEvent } from "react";
import SignaturePad from "@/components/contracts/SignaturePad";
import FormSubmitButton from "@/components/ui/FormSubmitButton";

type CompanySignatureFormProps = {
  action: (formData: FormData) => Promise<void>;
  clearLabel: string;
  submitIdleLabel: string;
  submitPendingLabel: string;
  missingSignatureLabel: string;
};

export default function CompanySignatureForm({
  action,
  clearLabel,
  submitIdleLabel,
  submitPendingLabel,
  missingSignatureLabel,
}: CompanySignatureFormProps) {
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!signatureDataUrl) {
      event.preventDefault();
      setError(missingSignatureLabel);
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="mt-4 max-w-md space-y-3">
      <input type="hidden" name="signatureDataUrl" value={signatureDataUrl ?? ""} />
      <SignaturePad
        onChange={(value) => {
          setSignatureDataUrl(value);
          if (value) {
            setError(null);
          }
        }}
        clearLabel={clearLabel}
        height={160}
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <FormSubmitButton
        idleLabel={submitIdleLabel}
        pendingLabel={submitPendingLabel}
        successLabel={submitIdleLabel}
        className="px-5 py-2.5"
      />
    </form>
  );
}
