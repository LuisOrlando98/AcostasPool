"use client";

import { useState } from "react";

type CoverageArea = {
  city: string;
  region: string;
  labelPos: { x: number; y: number };
  zipCodes: string[];
};

const COVERAGE_AREAS: CoverageArea[] = [
  {
    city: "Miami",
    region: "430,160 620,150 640,300 460,320",
    labelPos: { x: 525, y: 230 },
    zipCodes: ["33125", "33130", "33133", "33137", "33155"],
  },
  {
    city: "Kendall",
    region: "260,300 460,300 445,440 240,455",
    labelPos: { x: 348, y: 375 },
    zipCodes: ["33176", "33183", "33186", "33196"],
  },
  {
    city: "Coral Gables",
    region: "330,210 470,205 465,315 315,330",
    labelPos: { x: 395, y: 270 },
    zipCodes: ["33134", "33146", "33156"],
  },
  {
    city: "Doral",
    region: "260,95 405,92 405,205 245,215",
    labelPos: { x: 328, y: 153 },
    zipCodes: ["33122", "33166", "33172", "33178"],
  },
  {
    city: "Homestead",
    region: "360,445 610,438 596,512 342,512",
    labelPos: { x: 474, y: 482 },
    zipCodes: ["33030", "33032", "33033", "33035"],
  },
  {
    city: "Cutler Bay",
    region: "470,315 635,300 640,438 455,455",
    labelPos: { x: 548, y: 378 },
    zipCodes: ["33157", "33189", "33190"],
  },
];

export default function CoverageMapCard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const area = COVERAGE_AREAS[activeIndex] ?? COVERAGE_AREAS[0];

  return (
    <article className="lp-contact-card lp-contact-card-map lp-surface">
      <div className="lp-contact-map-head">
        <h2>Service area map</h2>
        <p>Select a city to highlight the coverage zone and view the ZIP codes we serve.</p>
      </div>

      <div className="lp-contact-map-layout">
        <div className="lp-contact-map-frame" aria-label="Coverage map">
          <svg
            className="lp-contact-map-svg"
            viewBox="0 0 1000 540"
            role="img"
            aria-label={`Coverage zones map, active city: ${area.city}`}
          >
            <defs>
              <linearGradient id="mapWater" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0f2b47" />
                <stop offset="100%" stopColor="#15456e" />
              </linearGradient>
              <radialGradient id="mapGlow" cx="50%" cy="50%" r="65%">
                <stop offset="0%" stopColor="rgba(88, 196, 255, 0.28)" />
                <stop offset="100%" stopColor="rgba(88, 196, 255, 0)" />
              </radialGradient>
            </defs>

            <rect x="0" y="0" width="1000" height="540" fill="url(#mapWater)" />
            <rect x="0" y="0" width="1000" height="540" fill="url(#mapGlow)" />

            <path
              className="lp-contact-map-coast"
              d="M140 70 720 52 860 150 882 262 846 366 772 470 686 515 218 532 126 452 102 348 98 235 120 144Z"
            />

            <path className="lp-contact-map-road" d="M180 100 760 460" />
            <path className="lp-contact-map-road" d="M220 490 640 120" />
            <path className="lp-contact-map-road" d="M170 260 830 265" />

            {COVERAGE_AREAS.map((item, index) => {
              const isActive = index === activeIndex;
              const citySlug = item.city.toLowerCase().replaceAll(" ", "-");
              return (
                <g key={item.city}>
                  <polygon
                    points={item.region}
                    className="lp-contact-map-region"
                    data-active={isActive}
                    role="button"
                    tabIndex={0}
                    aria-label={`Highlight ${item.city}`}
                    onClick={() => setActiveIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveIndex(index);
                      }
                    }}
                  />
                  <g
                    className="lp-contact-map-pin"
                    data-active={isActive}
                    onClick={() => setActiveIndex(index)}
                  >
                    <circle cx={item.labelPos.x} cy={item.labelPos.y} r="8" />
                    <text x={item.labelPos.x + 12} y={item.labelPos.y + 4} id={`map-label-${citySlug}`}>
                      {item.city}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="lp-contact-map-side">
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
        </div>
      </div>
    </article>
  );
}
