/**
 * Graphiques de l'espace professeur.
 *
 * Traces en SVG plutot qu'avec une bibliotheque : deux courbes et un
 * histogramme ne justifient pas cent kilo-octets de dependance.
 */

import { polylinePoints, safeNumber } from "../../pages/teacher/helpers";

export function LineChart({
  values,
  maxValue,
  colorClass,
}: {
  values: number[];
  maxValue: number;
  colorClass: string;
}) {
  const width = 280;
  const height = 84;
  const points = polylinePoints(values, maxValue, width, height);
  return (
    <svg className={`teacher-line-chart ${colorClass}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line x1="0" y1={height} x2={width} y2={height} />
      {points ? <polyline points={points} /> : null}
    </svg>
  );
}

export function BarChart({
  values,
  maxValue,
}: {
  values: number[];
  maxValue: number;
}) {
  return (
    <div className="teacher-bar-chart">
      {values.map((value, index) => {
        const heightPct = maxValue > 0 ? (Math.max(0, value) / maxValue) * 100 : 0;
        return (
          <span key={`${index}-${value}`} className="teacher-bar-chart-col">
            <i style={{ height: `${heightPct}%` }} />
          </span>
        );
      })}
    </div>
  );
}
