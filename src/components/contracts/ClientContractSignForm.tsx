"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/contracts/SignaturePad";

type ClientContractSignFormProps = {
  contractId: string;
  hint: string;
  clearLabel: string;
  submitIdleLabel: string;
  submitPendingLabel: string;
  missingSignatureLabel: string;
  errorLabel: string;
};

export default function ClientContractSignForm({
  contractId,
  hint,
  clearLabel,
  submitIdleLabel,
  submitPendingLabel,
  missingSignatureLabel,
  errorLabel,
}: ClientContractSignFormProps) {
  const router = useRouter();
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!signatureDataUrl) {
      setError(missingSignatureLabel);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/contract/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl }),
      });
      if (!res.ok) {
        setError(errorLabel);
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError(errorLabel);
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
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
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="app-button-primary px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? submitPendingLabel : submitIdleLabel}
      </button>
    </div>
  );
}
