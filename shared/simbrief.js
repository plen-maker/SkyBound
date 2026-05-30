/* SimBrief OFP fetch + parse. Works in Node (bridge) and React Native (app).
 * Endpoint confirmed: xml.fetcher.php?username=<u>&json=1  (or ?userid=<pilotid>)
 * Field names written defensively — verify against a real OFP dump once. */

const BASE = "https://www.simbrief.com/api/xml.fetcher.php";

export async function fetchOFP({ username, userid } = {}) {
  const q = username ? `username=${encodeURIComponent(username)}` : `userid=${encodeURIComponent(userid)}`;
  const res = await fetch(`${BASE}?${q}&json=1`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`SimBrief HTTP ${res.status}`);
  const data = await res.json();
  if (data?.fetch?.status === "Error") throw new Error(`SimBrief: ${data.fetch.message}`);
  return parseOFP(data);
}

const n = (v) => (v == null || v === "" ? null : Number(v));
const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

export function parseOFP(d) {
  const w = d.weights || {}, f = d.fuel || {}, g = d.general || {};
  const fixes = toArray(d?.navlog?.fix).map((x) => ({
    ident: x.ident,
    name: x.name,
    type: x.type,                          // wpt / apt / vor ...
    lat: n(x.pos_lat),
    lon: n(x.pos_long),
    altitude: n(x.altitude_feet),
    stage: x.stage,                        // CLB / CRZ / DSC
    legDistanceNm: n(x.distance),
    eteFromStartSec: n(x.time_total),
    groundspeed: n(x.groundspeed),
  })).filter((x) => x.ident);

  return {
    callsign: d?.atc?.callsign || d?.general?.icao_airline || null,
    aircraft: `${d?.aircraft?.icaocode || ""} ${d?.aircraft?.name || ""}`.trim(),
    dep: d?.origin?.icao_code || null,
    arr: d?.destination?.icao_code || null,
    altn: d?.alternate?.icao_code || null,
    costindex: n(g.costindex),
    route: g.route || null,
    routeDistanceNm: n(g.route_distance) ?? n(g.air_distance),
    units: w.units || d?.params?.units || "kg",  // usually kg or lb per account
    pax: n(w.pax_count) ?? n(w.pax_count_actual),
    payload: n(w.payload),
    cargo: n(w.cargo),
    zfw: n(w.est_zfw) ?? n(w.oew),
    tow: n(w.est_tow),
    blockFuel: n(f.plan_ramp) ?? n(f.min_takeoff),
    enrouteBurn: n(f.enroute_burn),
    fixes,
  };
}
