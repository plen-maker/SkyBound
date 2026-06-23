/* Mock sim — Linux dev mode, --mock flag */

// Fake flight: LHBP → LOWW (Budapest → Vienna, ~200nm)
const ROUTE = [
  { lat: 47.4369, lon: 19.2556, altFt:     0, gsKt:   0, phase: "ground" },
  { lat: 47.5000, lon: 18.8000, altFt:  8000, gsKt: 180, phase: "climb"  },
  { lat: 47.6000, lon: 17.8000, altFt: 24000, gsKt: 280, phase: "climb"  },
  { lat: 47.8000, lon: 16.8000, altFt: 33000, gsKt: 420, phase: "cruise" },
  { lat: 48.0000, lon: 16.3000, altFt: 33000, gsKt: 420, phase: "cruise" },
  { lat: 48.1000, lon: 16.2000, altFt: 20000, gsKt: 320, phase: "descent"},
  { lat: 48.1300, lon: 16.2000, altFt:  5000, gsKt: 180, phase: "descent"},
  { lat: 48.1100, lon: 16.5500, altFt:   500, gsKt: 140, phase: "approach"},
  { lat: 48.1102, lon: 16.5697, altFt:     0, gsKt:  60, phase: "ground" },
];

function lerp(a, b, t) { return a + (b - a) * t; }

function interpolateRoute(t) {
  const seg = t * (ROUTE.length - 1);
  const i = Math.min(Math.floor(seg), ROUTE.length - 2);
  const frac = seg - i;
  const a = ROUTE[i], b = ROUTE[i + 1];
  return {
    lat:       lerp(a.lat,   b.lat,   frac),
    lon:       lerp(a.lon,   b.lon,   frac),
    altFt:     lerp(a.altFt, b.altFt, frac),
    gsKt:      lerp(a.gsKt,  b.gsKt,  frac),
    phase:     a.phase,
  };
}

export function startMock(onData, { intervalMs = 1000, durationMs = 120_000 } = {}) {
  const start = Date.now();
  let lastPhase = "";

  const timer = setInterval(() => {
    const elapsed = Date.now() - start;
    const t = Math.min(elapsed / durationMs, 1);
    const pos = interpolateRoute(t);

    const onGround = pos.phase === "ground";
    const vsFpm = pos.altFt > 0
      ? (pos.phase === "climb" ? 1800 : pos.phase === "descent" || pos.phase === "approach" ? -800 : 0)
      : 0;

    const wpNextLat = 48.1102, wpNextLon = 16.5697;
    const dLat = wpNextLat - pos.lat, dLon = wpNextLon - pos.lon;
    const wpDistNm = Math.sqrt(dLat * dLat + dLon * dLon) * 60;

    const data = {
      lat:          pos.lat  + (Math.random() - 0.5) * 0.0001,
      lon:          pos.lon  + (Math.random() - 0.5) * 0.0001,
      altFt:        Math.round(pos.altFt + (Math.random() - 0.5) * 20),
      gsKt:         Math.round(pos.gsKt  + (Math.random() - 0.5) * 2),
      vsFpm:        Math.round(vsFpm     + (Math.random() - 0.5) * 50),
      wpDistNm:     Math.max(0, wpDistNm),
      destEteMin:   Math.max(0, (1 - t) * durationMs / 60000),
      wpNextLat,
      wpNextLon,
      onGround,
      headingDeg:   Math.round(270 + (Math.random() - 0.5) * 5),
      iasKt:        Math.round(pos.gsKt * 0.95 + (Math.random() - 0.5) * 2),
      aircraftTitle: "Airbus A320 Neo (LHBP→LOWW mock)",
      ts:           Date.now(),
      source:       "mock",
    };

    if (pos.phase !== lastPhase) {
      console.log(`[mock] fázis: ${pos.phase} | alt=${data.altFt}ft gs=${data.gsKt}kt`);
      lastPhase = pos.phase;
    }

    onData(data);

    if (t >= 1) {
      clearInterval(timer);
      console.log("[mock] repülés vége (LOWW)");
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
