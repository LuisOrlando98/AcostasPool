"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import type {
  GoogleAddressComponent,
  GoogleAutocomplete,
} from "@/lib/ui/google-maps-types";

const GOOGLE_SCRIPT_ID = "google-maps-places";

type AddressDefaults = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};

type AddressAutocompleteProps = {
  defaultValue?: AddressDefaults;
  line1Name?: string;
  line2Name?: string;
  cityName?: string;
  stateName?: string;
  postalName?: string;
  required?: boolean;
  theme?: "light" | "dark";
};

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

const getComponentValue = (
  components: GoogleAddressComponent[] | undefined,
  type: string,
  useShortName = false
) => {
  const component = components?.find((item) => item.types.includes(type));
  if (!component) {
    return "";
  }
  return useShortName ? component.short_name : component.long_name;
};

export default function AddressAutocomplete({
  defaultValue,
  line1Name = "direccionLinea1",
  line2Name = "direccionLinea2",
  cityName = "ciudad",
  stateName = "estadoProvincia",
  postalName = "codigoPostal",
  required = false,
  theme = "light",
}: AddressAutocompleteProps) {
  const { t, locale } = useI18n();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);

  const [line1, setLine1] = useState(defaultValue?.line1 ?? "");
  const [line2, setLine2] = useState(defaultValue?.line2 ?? "");
  const [city, setCity] = useState(defaultValue?.city ?? "");
  const [state, setState] = useState(defaultValue?.state ?? "");
  const [postalCode, setPostalCode] = useState(defaultValue?.postalCode ?? "");
  const [autocompleteReady, setAutocompleteReady] = useState(false);
  const fieldId = useId();
  const fieldIds = {
    line1: `${fieldId}-line1`,
    line2: `${fieldId}-line2`,
    city: `${fieldId}-city`,
    state: `${fieldId}-state`,
    postalCode: `${fieldId}-postal-code`,
  };
  const labelClass =
    theme === "dark"
      ? "text-slate-400"
      : "text-slate-500";
  const inputClass =
    theme === "dark"
      ? "rounded-xl border border-white/10 bg-slate-950/40 text-white"
      : "app-input";
  const helpClass =
    theme === "dark"
      ? "text-slate-400"
      : "text-slate-400";
  const warningClass =
    theme === "dark"
      ? "text-indigo-400"
      : "text-indigo-600";
  const countryClass =
    theme === "dark"
      ? "border-white/10 bg-white/5 text-slate-200"
      : "border-slate-200 bg-slate-50 text-slate-600";

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
      const autocomplete = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["address_components", "formatted_address"],
        }
      );
      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const components = place?.address_components ?? [];
        const streetNumber = getComponentValue(components, "street_number");
        const route = getComponentValue(components, "route");
        const postalBase = getComponentValue(components, "postal_code");
        const postalSuffix = getComponentValue(
          components,
          "postal_code_suffix"
        );
        const computedPostal = postalSuffix
          ? `${postalBase}-${postalSuffix}`
          : postalBase;
        const computedLine1 = [streetNumber, route]
          .filter(Boolean)
          .join(" ")
          .trim();
        const fallbackLine1 = place?.formatted_address
          ? place.formatted_address.split(",")[0]?.trim()
          : "";

        const cityValue =
          getComponentValue(components, "locality") ||
          getComponentValue(components, "sublocality") ||
          getComponentValue(components, "administrative_area_level_3");

        const stateValue = getComponentValue(
          components,
          "administrative_area_level_1",
          true
        );

        const nextLine1 = computedLine1 || fallbackLine1;
        if (nextLine1) {
          setLine1(nextLine1);
        }
        if (cityValue) {
          setCity(cityValue);
        }
        if (stateValue) {
          setState(stateValue);
        }
        if (computedPostal) {
          setPostalCode(computedPostal);
        }
      });
    }

    return () => {
      const autocomplete = autocompleteRef.current;
      if (!autocomplete) {
        return;
      }
      window.google?.maps?.event?.clearInstanceListeners(autocomplete);
      autocompleteRef.current = null;
    };
  }, [autocompleteReady]);

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={fieldIds.line1}
          className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}
        >
          {t("address.line1")}
        </label>
        <input
          id={fieldIds.line1}
          ref={inputRef}
          name={line1Name}
          value={line1}
          onChange={(event) => setLine1(event.target.value)}
          className={`mt-2 w-full px-4 py-3 text-sm ${inputClass}`}
          placeholder={t("address.placeholders.line1")}
          required={required}
          autoComplete="off"
        />
        {apiKey ? (
          <p className={`mt-2 text-[11px] ${helpClass}`}>
            {t("address.autocomplete.enabled")}
          </p>
        ) : (
          <p className={`mt-2 text-[11px] ${warningClass}`}>
            {t("address.autocomplete.missingKey")}
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor={fieldIds.line2}
          className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}
        >
          {t("address.line2")}
        </label>
        <input
          id={fieldIds.line2}
          name={line2Name}
          value={line2}
          onChange={(event) => setLine2(event.target.value)}
          className={`mt-2 w-full px-4 py-3 text-sm ${inputClass}`}
          placeholder={t("address.placeholders.line2")}
          autoComplete="address-line2"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div>
          <label
            htmlFor={fieldIds.city}
            className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}
          >
            {t("address.city")}
          </label>
          <input
            id={fieldIds.city}
            name={cityName}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className={`mt-2 w-full px-4 py-3 text-sm ${inputClass}`}
            placeholder={t("address.placeholders.city")}
            autoComplete="address-level2"
          />
        </div>
        <div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
            {t("address.country")}
          </span>
          <div
            className={`mt-2 flex h-[46px] items-center justify-center rounded-xl border text-sm font-semibold ${countryClass}`}
          >
            {t("address.countryValue")}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={fieldIds.state}
            className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}
          >
            {t("address.state")}
          </label>
          <input
            id={fieldIds.state}
            name={stateName}
            value={state}
            onChange={(event) => setState(event.target.value)}
            className={`mt-2 w-full px-4 py-3 text-sm ${inputClass}`}
            placeholder={t("address.placeholders.state")}
            autoComplete="address-level1"
          />
        </div>
        <div>
          <label
            htmlFor={fieldIds.postalCode}
            className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}
          >
            {t("address.postal")}
          </label>
          <input
            id={fieldIds.postalCode}
            name={postalName}
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            className={`mt-2 w-full px-4 py-3 text-sm ${inputClass}`}
            placeholder={t("address.placeholders.postal")}
            autoComplete="postal-code"
          />
        </div>
      </div>
    </div>
  );
}
