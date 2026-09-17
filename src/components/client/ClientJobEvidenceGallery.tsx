"use client";

import { useState } from "react";
import AppModal from "@/components/ui/AppModal";
import { getAssetUrl } from "@/lib/assets";
import { formatInBusinessTimeZone } from "@/lib/timezone";

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

const LIGHTBOX_Z_INDEX_CLASS = "z-[1600]";

export default function ClientJobEvidenceGallery({
  photos,
  locale,
  evidenceAlt,
  viewLabel,
  closeLabel,
}: ClientJobEvidenceGalleryProps) {
  const [activePhoto, setActivePhoto] = useState<EvidencePhoto | null>(null);
  const closeLightbox = () => setActivePhoto(null);

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
              <span>
                {formatInBusinessTimeZone(photo.takenAt, locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              <span className="font-semibold text-sky-700">{viewLabel}</span>
            </div>
          </button>
        ))}
      </div>

      {activePhoto ? (
        <AppModal
          open
          onClose={closeLightbox}
          title={evidenceAlt}
          zIndexClass={LIGHTBOX_Z_INDEX_CLASS}
          layerClassName="p-3 sm:p-6"
          backdropClassName="bg-slate-950/75 backdrop-blur-[1px]"
          cardClassName="max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 sm:px-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {formatInBusinessTimeZone(activePhoto.takenAt, locale, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
            <button
              type="button"
              onClick={closeLightbox}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
            >
              {closeLabel}
            </button>
          </div>
          <div className="max-h-[80dvh] overflow-auto bg-slate-100">
            <img
              src={getAssetUrl(activePhoto.url)}
              alt={evidenceAlt}
              className="mx-auto h-auto w-auto max-h-[78dvh] max-w-full object-contain"
            />
          </div>
        </AppModal>
      ) : null}
    </>
  );
}
