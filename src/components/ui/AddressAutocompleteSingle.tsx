"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

const GOOGLE_SCRIPT_ID = "google-maps-places";

type AddressAutocompleteSingleProps = {
  name?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string | null;
  required?: boolean;
  theme?: "light" | "dark";
  size?: "default" | "compact";
  showHelper?: boolean;
};

declare global {
  interface Window {
    google?: any;
  }
}

const loadGooglePlaces = (apiKey: string, locale: string) =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    const existing = document.getElementById(
      GOOGLE_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject());
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${locale}&region=US`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });

export default function AddressAutocompleteSingle({
  name = "address",
  label,
  placeholder,
  defaultValue = "",
  required = false,
  theme = "light",
  size = "default",
  showHelper = true,
}: AddressAutocompleteSingleProps) {
  const { t, locale } = useI18n();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);

  const [value, setValue] = useState(defaultValue ?? "");
  const [autocompleteReady, setAutocompleteReady] = useState(false);

  const labelClass =
    theme === "dark"
      ? "text-slate-400"
      : "text-slate-500";
  const inputClass =
    theme === "dark"
      ? "border-white/10 bg-slate-950/40 text-white"
      : "app-input";
  const helpClass =
    theme === "dark"
      ? "text-slate-400"
      : "text-slate-400";
  const warningClass =
    theme === "dark"
      ? "text-indigo-400"
      : "text-indigo-600";
  const sizeClass =
    size === "compact"
      ? "rounded-lg px-3 py-2 text-xs"
      : "rounded-xl px-4 py-3 text-sm";
  const labelSize =
    size === "compact"
      ? "text-[11px]"
      : "text-xs";

  useEffect(() => {
    let mounted = true;
    if (!apiKey) {
      return () => undefined;
    }
    loadGooglePlaces(apiKey, locale)
      .then(() => {
        if (!mounted) {
          return;
        }
        setAutocompleteReady(true);
      })
      .catch(() => {
        if (mounted) {
          setAutocompleteReady(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [apiKey, locale]);

  useEffect(() => {
    if (!autocompleteReady || !inputRef.current || !window.google?.maps?.places) {
      return;
    }

    if (!autocompleteRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address"],
        }
      );

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        const formatted = place?.formatted_address?.trim();
        if (formatted) {
          setValue(formatted);
        }
      });
    }
  }, [autocompleteReady]);

  const resolvedPlaceholder = placeholder ?? t("address.placeholders.line1");
  const inputSpacing = label ? "mt-2" : "";

  return (
    <div>
      {label ? (
        <label
          className={`${labelSize} font-semibold uppercase tracking-wider ${labelClass}`}
        >
          {label}
        </label>
      ) : null}
      <input
        ref={inputRef}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={`${inputSpacing} w-full border ${sizeClass} ${inputClass}`}
        placeholder={resolvedPlaceholder}
        required={required}
        autoComplete="off"
      />
      {showHelper ? (
        apiKey ? (
          <p className={`mt-2 text-[11px] ${helpClass}`}>
            {t("address.autocomplete.enabled")}
          </p>
        ) : (
          <p className={`mt-2 text-[11px] ${warningClass}`}>
            {t("address.autocomplete.missingKey")}
          </p>
        )
      ) : null}
    </div>
  );
}
