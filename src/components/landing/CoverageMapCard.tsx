"use client";

import { useState } from "react";

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

const MAP_BOUNDS: GeoBounds = {
  north: 25.92,
  south: 25.34,
  east: -80.08,
  west: -80.58,
};

const MAP_EMBED_URL = `https://www.openstreetmap.org/export/embed.html?bbox=${MAP_BOUNDS.west}%2C${MAP_BOUNDS.south}%2C${MAP_BOUNDS.east}%2C${MAP_BOUNDS.north}&layer=mapnik`;

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

function lngToPercent(lng: number) {
  return ((lng - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * 100;
}

function latToPercent(lat: number) {
  return ((MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * 100;
}

function getAreaShape(area: CoverageArea) {
  const left = lngToPercent(area.bounds.west);
  const right = lngToPercent(area.bounds.east);
  const top = latToPercent(area.bounds.north);
  const bottom = latToPercent(area.bounds.south);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

export default function CoverageMapCard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const area = COVERAGE_AREAS[activeIndex] ?? COVERAGE_AREAS[0];
  const citySlug = area.city.toLowerCase().replaceAll(" ", "-");

  return (
    <article className="lp-contact-card lp-contact-card-map lp-surface">
      <div className="lp-contact-map-head">
        <h2>Service area map</h2>
        <p>Select a city to highlight the coverage zone and view the ZIP codes we serve.</p>
      </div>

      <div className="lp-contact-map-cities" role="tablist" aria-label="Service cities">
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
        <div className="lp-contact-map-frame" aria-label={`Coverage map, active city: ${area.city}`}>
          <div className="lp-contact-map-stage">
            <iframe
              title="South Florida service map"
              className="lp-contact-map-embed"
              src={MAP_EMBED_URL}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />

            <svg className="lp-contact-map-overlay" viewBox="0 0 100 100" aria-hidden="true">
              {COVERAGE_AREAS.map((item, index) => {
                const isActive = index === activeIndex;
                const shape = getAreaShape(item);
                return (
                  <g key={item.city}>
                    <rect
                      x={shape.left}
                      y={shape.top}
                      width={shape.width}
                      height={shape.height}
                      rx={1.2}
                      className="lp-contact-map-region"
                      data-active={isActive}
                    />
                    <circle
                      cx={shape.centerX}
                      cy={shape.centerY}
                      r={1.08}
                      className="lp-contact-map-pin-dot"
                      data-active={isActive}
                    />
                    <text
                      x={shape.centerX + 1.5}
                      y={shape.centerY + 0.66}
                      className="lp-contact-map-pin-label"
                      data-active={isActive}
                    >
                      {item.city}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <p className="lp-contact-map-source">
            Map data by OpenStreetMap contributors.
            <a
              href={`https://www.openstreetmap.org/?mlat=${area.center.lat}&mlon=${area.center.lng}#map=11/${area.center.lat}/${area.center.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open full map
            </a>
          </p>
        </div>
        <div
          className="lp-contact-map-zipcodes"
          role="tabpanel"
          id="coverage-panel"
          aria-labelledby={`coverage-tab-${citySlug}`}
        >
          <p>ZIP codes in {area.city}</p>
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
