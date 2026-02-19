"use client";

import { useState } from "react";
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

const COVERAGE_AREAS: CoverageArea[] = [
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
    lead: "Select a city to center the map and view the ZIP codes we serve.",
    tabLabel: "Service cities",
    frameLabel: "Map centered on",
    iframeTitle: "South Florida service map",
    source: "Map data by OpenStreetMap contributors.",
    openMap: "Open full map",
    zipcodesPrefix: "ZIP codes in",
  },
  es: {
    title: "Mapa de cobertura",
    lead: "Selecciona una ciudad para centrar el mapa y ver los codigos ZIP disponibles.",
    tabLabel: "Ciudades de servicio",
    frameLabel: "Mapa centrado en",
    iframeTitle: "Mapa de servicio en South Florida",
    source: "Datos del mapa por colaboradores de OpenStreetMap.",
    openMap: "Abrir mapa completo",
    zipcodesPrefix: "Codigos ZIP en",
  },
};

function getMapEmbedUrl(area: CoverageArea) {
  const bbox = `${area.bounds.west},${area.bounds.south},${area.bounds.east},${area.bounds.north}`;
  const marker = `${area.center.lat},${area.center.lng}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}

export default function CoverageMapCard({ language = "en" }: { language?: LandingLocale }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const area = COVERAGE_AREAS[activeIndex] ?? COVERAGE_AREAS[0];
  const citySlug = area.city.toLowerCase().replaceAll(" ", "-");
  const copy = MAP_COPY[language];
  const mapEmbedUrl = getMapEmbedUrl(area);

  return (
    <article className="lp-contact-card lp-contact-card-map lp-surface">
      <div className="lp-contact-map-head">
        <h2>{copy.title}</h2>
        <p>{copy.lead}</p>
      </div>

      <div className="lp-contact-map-cities" role="tablist" aria-label={copy.tabLabel}>
        {COVERAGE_AREAS.map((item, index) => {
          const itemSlug = item.city.toLowerCase().replaceAll(" ", "-");
          return (
            <button
              key={item.city}
              type="button"
              className="lp-contact-map-city-btn"
              data-active={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              role="tab"
              aria-selected={index === activeIndex}
              aria-controls="coverage-panel"
              id={`coverage-tab-${itemSlug}`}
            >
              {item.city}
            </button>
          );
        })}
      </div>

      <div className="lp-contact-map-layout">
        <div className="lp-contact-map-frame" aria-label={`${copy.frameLabel}: ${area.city}`}>
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
