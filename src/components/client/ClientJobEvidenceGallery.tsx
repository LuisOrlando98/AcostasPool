"use client";

import { useEffect, useState } from "react";
import { getAssetUrl } from "@/lib/assets";

type EvidencePhoto = {
  id: string;
  url: string;
  takenAt: string;
};

type ClientJobEvidenceGalleryProps = {
  photos: EvidencePhoto[];
  locale: string;
  evidenceAlt: string;
  viewLabel: string;
  closeLabel: string;
};

export default function ClientJobEvidenceGallery({
  photos,
  locale,
  evidenceAlt,
  viewLabel,
  closeLabel,
}: ClientJobEvidenceGalleryProps) {
  const [activePhoto, setActivePhoto] = useState<EvidencePhoto | null>(null);

  useEffect(() => {
    if (!activePhoto) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePhoto(null);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePhoto]);

  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActivePhoto(photo)}
            className="group overflow-hidden rounded-xl border border-slate-100 bg-slate-50 text-left transition hover:border-sky-200 hover:shadow-sm"
          >
            <img
              src={getAssetUrl(photo.url)}
              alt={evidenceAlt}
              className="h-36 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
            />
            <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-500">
              <span>{new Date(photo.takenAt).toLocaleString(locale)}</span>
              <span className="font-semibold text-sky-700">{viewLabel}</span>
            </div>
          </button>
        ))}
      </div>

      {activePhoto ? (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setActivePhoto(null)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px]"
          />
          <div className="relative z-[1] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 sm:px-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {new Date(activePhoto.takenAt).toLocaleString(locale)}
              </p>
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
              >
                {closeLabel}
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-slate-100">
              <img
                src={getAssetUrl(activePhoto.url)}
                alt={evidenceAlt}
                className="mx-auto h-auto w-auto max-h-[78vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
