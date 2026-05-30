/* Navigation math: great-circle distance/bearing, ETE, Top-of-Descent. */
const R_NM = 3440.065;                 // Earth radius in nautical miles
const rad = (d) => (d * Math.PI) / 180;

export function distanceNm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function eteMin(distNm, gsKt) {
  if (!gsKt || gsKt < 5) return Infinity;
  return (distNm / gsKt) * 60;
}

/* Top of Descent using the 3:1 rule (3° path ≈ 318 ft/nm ≈ 3 nm per 1000 ft).
 * Returns nm-from-destination at which descent should begin. */
export function todDistanceNm(altFt, fieldElevFt = 0) {
  const toLose = Math.max(0, altFt - fieldElevFt);
  return (toLose / 1000) * 3;
}

/* Minutes until Top of Descent, given remaining distance to destination. */
export function eteToTodMin(distToDestNm, altFt, gsKt, fieldElevFt = 0) {
  const tod = todDistanceNm(altFt, fieldElevFt);
  return eteMin(Math.max(0, distToDestNm - tod), gsKt);
}
