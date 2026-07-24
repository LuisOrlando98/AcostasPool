"use client";

import { useState, type FormEvent } from "react";
import SignaturePad from "@/components/contracts/SignaturePad";
import FormSubmitButton from "@/components/ui/FormSubmitButton";

type ContractInPersonSignFormProps = {
  action: (formData: FormData) => Promise<void>;
  contractId: string;
  customerId: string;
  hint: string;
  clearLabel: string;
  submitIdleLabel: string;
  submitPendingLabel: string;
  missingSignatureLabel: string;
};

export default function ContractInPersonSignForm({
  action,
  contractId,
  customerId,
  hint,
  clearLabel,
  submitIdleLabel,
  submitPendingLabel,
  missingSignatureLabel,
}: ContractInPersonSignFormProps) {
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!signatureDataUrl) {
      event.preventDefault();
      setError(missingSignatureLabel);
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="mt-3 space-y-3">
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="signatureDataUrl" value={signatureDataUrl ?? ""} />
      <p className="text-xs text-slate-500">{hint}</p>
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
        className="px-4 py-2 text-xs"
      />
    </form>
  );
}
