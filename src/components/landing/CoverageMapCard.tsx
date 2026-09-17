"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { LandingLocale } from "@/components/landing/preferences";

type GeoBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type CoverageArea = {
  city: string;
  bounds: GeoBounds;
  center: { lat: number; lng: number };
  zipCodes: string[];
};

/* Keep the city list in sync with LANDING_SERVICE_AREAS (src/lib/landing-config.ts). */
const COVERAGE_AREAS: CoverageArea[] = [
  {
    city: "Miami Gardens",
    bounds: { north: 25.99, south: 25.88, west: -80.3, east: -80.18 },
    center: { lat: 25.942, lng: -80.2456 },
    zipCodes: ["33054", "33055", "33056"],
  },
  {
    city: "Miramar",
    bounds: { north: 26.05, south: 25.95, west: -80.38, east: -80.2 },
    center: { lat: 25.9861, lng: -80.3036 },
    zipCodes: ["33023", "33025", "33027", "33029"],
  },
  {
    city: "Miami",
    bounds: { north: 25.86, south: 25.7, west: -80.31, east: -80.11 },
    center: { lat: 25.7617, lng: -80.1918 },
    zipCodes: ["33125", "33130", "33133", "33137", "33155"],
  },
  {
    city: "Kendall",
    bounds: { north: 25.73, south: 25.62, west: -80.4, east: -80.24 },
    center: { lat: 25.6793, lng: -80.3173 },
    zipCodes: ["33176", "33183", "33186", "33196"],
  },
  {
    city: "Coral Gables",
    bounds: { north: 25.78, south: 25.67, west: -80.33, east: -80.2 },
    center: { lat: 25.7215, lng: -80.2684 },
    zipCodes: ["33134", "33146", "33156"],
  },
  {
    city: "Doral",
    bounds: { north: 25.88, south: 25.77, west: -80.43, east: -80.29 },
    center: { lat: 25.8195, lng: -80.3553 },
    zipCodes: ["33122", "33166", "33172", "33178"],
  },
  {
    city: "Homestead",
    bounds: { north: 25.56, south: 25.37, west: -80.55, east: -80.35 },
    center: { lat: 25.4687, lng: -80.4776 },
    zipCodes: ["33030", "33032", "33033", "33035"],
  },
  {
    city: "Cutler Bay",
    bounds: { north: 25.65, south: 25.52, west: -80.42, east: -80.28 },
    center: { lat: 25.5808, lng: -80.3467 },
    zipCodes: ["33157", "33189", "33190"],
  },
];

const MAP_COPY: Record<
  LandingLocale,
  {
    title: string;
    lead: string;
    tabLabel: string;
    frameLabel: string;
    iframeTitle: string;
    source: string;
    openMap: string;
    zipcodesPrefix: string;
  }
> = {
  en: {
    title: "Service area map",
    lead: "Coverage reaches north to Miramar and Miami Gardens, then extends south across our service zone.",
    tabLabel: "Service cities",
    frameLabel: "Map centered on",
    iframeTitle: "South Florida service map",
    source: "Map data by OpenStreetMap contributors.",
    openMap: "Open full map",
    zipcodesPrefix: "ZIP codes in",
  },
  es: {
    title: "Mapa de cobertura",
    lead: "La cobertura llega al norte hasta Miramar y Miami Gardens, y desde ahí atendemos todo hacia el sur.",
    tabLabel: "Ciudades de servicio",
    frameLabel: "Mapa centrado en",
    iframeTitle: "Mapa de servicio en South Florida",
    source: "Datos del mapa por colaboradores de OpenStreetMap.",
    openMap: "Abrir mapa completo",
    zipcodesPrefix: "Códigos ZIP en",
  },
};

function getMapEmbedUrl(area: CoverageArea) {
  const bbox = `${area.bounds.west},${area.bounds.south},${area.bounds.east},${area.bounds.north}`;
  const marker = `${area.center.lat},${area.center.lng}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}

function toCitySlug(city: string) {
  return city.toLowerCase().replaceAll(" ", "-");
}

/** Resolves the tab index targeted by a WAI-ARIA tablist key (arrows wrap around). */
function getTabIndexForKey(key: string, currentIndex: number, count: number): number | null {
  const lastIndex = count - 1;
  switch (key) {
    case "ArrowRight":
      return currentIndex === lastIndex ? 0 : currentIndex + 1;
    case "ArrowLeft":
      return currentIndex === 0 ? lastIndex : currentIndex - 1;
    case "Home":
      return 0;
    case "End":
      return lastIndex;
    default:
      return null;
  }
}

export default function CoverageMapCard({ language = "en" }: { language?: LandingLocale }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const area = COVERAGE_AREAS[activeIndex] ?? COVERAGE_AREAS[0];
  const citySlug = toCitySlug(area.city);
  const copy = MAP_COPY[language];
  const mapEmbedUrl = getMapEmbedUrl(area);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const nextIndex = getTabIndexForKey(event.key, index, COVERAGE_AREAS.length);
    if (nextIndex === null) {
      return;
    }
    event.preventDefault();
    setActiveIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <article className="lp-contact-card lp-contact-card-map lp-surface">
      <div className="lp-contact-map-head">
        <h2>{copy.title}</h2>
        <p>{copy.lead}</p>
      </div>

      <div className="lp-contact-map-cities" role="tablist" aria-label={copy.tabLabel}>
        {COVERAGE_AREAS.map((item, index) => {
          const itemSlug = toCitySlug(item.city);
          const selected = index === activeIndex;
          return (
            <button
              key={item.city}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              className="lp-contact-map-city-btn"
              data-active={selected}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              aria-selected={selected}
              aria-controls="coverage-panel"
              tabIndex={selected ? 0 : -1}
              id={`coverage-tab-${itemSlug}`}
            >
              {item.city}
            </button>
          );
        })}
      </div>

      <div className="lp-contact-map-layout">
        <div
          className="lp-contact-map-frame"
          role="group"
          aria-label={`${copy.frameLabel}: ${area.city}`}
        >
          <div className="lp-contact-map-stage">
            <iframe
              key={area.city}
              title={copy.iframeTitle}
              className="lp-contact-map-embed"
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <p className="lp-contact-map-source">
            {copy.source}
            <a
              href={`https://www.openstreetmap.org/?mlat=${area.center.lat}&mlon=${area.center.lng}#map=11/${area.center.lat}/${area.center.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {copy.openMap}
            </a>
          </p>
        </div>
        <div
          className="lp-contact-map-zipcodes"
          role="tabpanel"
          id="coverage-panel"
          aria-labelledby={`coverage-tab-${citySlug}`}
          tabIndex={0}
        >
          <p>
            {copy.zipcodesPrefix} {area.city}
          </p>
          <ul>
            {area.zipCodes.map((zipCode) => (
              <li key={zipCode}>{zipCode}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
