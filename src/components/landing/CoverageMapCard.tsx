"use client";

import { useMemo, useState } from "react";

type CoverageArea = {
  city: string;
  center: { lat: number; lon: number };
  zipCodes: string[];
};

const COVERAGE_AREAS: CoverageArea[] = [
  {
    city: "Miami",
    center: { lat: 25.7617, lon: -80.1918 },
    zipCodes: ["33125", "33130", "33133", "33137", "33155"],
  },
  {
    city: "Kendall",
    center: { lat: 25.6793, lon: -80.3173 },
    zipCodes: ["33176", "33183", "33186", "33196"],
  },
  {
    city: "Coral Gables",
    center: { lat: 25.7215, lon: -80.2684 },
    zipCodes: ["33134", "33146", "33156"],
  },
  {
    city: "Doral",
    center: { lat: 25.8195, lon: -80.3553 },
    zipCodes: ["33122", "33166", "33172", "33178"],
  },
  {
    city: "Homestead",
    center: { lat: 25.4687, lon: -80.4776 },
    zipCodes: ["33030", "33032", "33033", "33035"],
  },
  {
    city: "Cutler Bay",
    center: { lat: 25.5808, lon: -80.3467 },
    zipCodes: ["33157", "33189", "33190"],
  },
];

function getMapEmbedUrl(lat: number, lon: number) {
  const lonDelta = 0.105;
  const latDelta = 0.075;
  const left = lon - lonDelta;
  const right = lon + lonDelta;
  const bottom = lat - latDelta;
  const top = lat + latDelta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left.toFixed(5)}%2C${bottom.toFixed(5)}%2C${right.toFixed(5)}%2C${top.toFixed(5)}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lon.toFixed(5)}`;
}

export default function CoverageMapCard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const area = COVERAGE_AREAS[activeIndex] ?? COVERAGE_AREAS[0];

  const mapSrc = useMemo(() => {
    return getMapEmbedUrl(area.center.lat, area.center.lon);
  }, [area.center.lat, area.center.lon]);

  return (
    <article className="lp-contact-card lp-contact-card-map lp-surface">
      <div className="lp-contact-map-head">
        <h2>Service area map</h2>
        <p>Select a city to view the ZIP codes we currently cover.</p>
      </div>

      <div className="lp-contact-map-cities" role="tablist" aria-label="Service cities">
        {COVERAGE_AREAS.map((item, index) => (
          <button
            key={item.city}
            type="button"
            className="lp-contact-map-city-btn"
            data-active={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            role="tab"
            aria-selected={index === activeIndex}
            aria-controls={`coverage-panel-${item.city.toLowerCase().replaceAll(" ", "-")}`}
            id={`coverage-tab-${item.city.toLowerCase().replaceAll(" ", "-")}`}
          >
            {item.city}
          </button>
        ))}
      </div>

      <div className="lp-contact-map-frame">
        <iframe
          src={mapSrc}
          title={`Coverage map centered on ${area.city}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div
        className="lp-contact-map-zipcodes"
        role="tabpanel"
        id={`coverage-panel-${area.city.toLowerCase().replaceAll(" ", "-")}`}
        aria-labelledby={`coverage-tab-${area.city.toLowerCase().replaceAll(" ", "-")}`}
      >
        <p>ZIP codes in {area.city}</p>
        <ul>
          {area.zipCodes.map((zipCode) => (
            <li key={zipCode}>{zipCode}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
