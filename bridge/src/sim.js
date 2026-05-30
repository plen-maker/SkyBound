/* MSFS telemetry reader via node-simconnect (pure TS lib, no SDK files needed).
 * API surface verified from node-simconnect docs:
 *   open() -> { handle }, handle.addToDataDefinition(), requestDataOnSimObject(),
 *   handle.on('simObjectData', recv => recv.data.readFloat64() in definition order).
 * SimVar names/units below should be confirmed against the MSFS SimConnect SimVars list. */
import {
  open, Protocol, SimConnectDataType, SimConnectPeriod, SimConnectConstants,
} from "node-simconnect";

const DEF = 0, REQ = 0;

// definition order MUST match the read order in the handler below
const VARS = [
  ["PLANE LATITUDE", "degrees"],
  ["PLANE LONGITUDE", "degrees"],
  ["PLANE ALTITUDE", "feet"],
  ["GROUND VELOCITY", "knots"],
  ["VERTICAL SPEED", "feet per minute"],
  ["GPS WP DISTANCE", "meters"],     // distance to active FP next waypoint
  ["GPS WP ETE", "seconds"],         // ETE to next waypoint (sim FMS)
  ["GPS ETE", "seconds"],            // ETE to destination (sim FMS)
  ["GPS WP NEXT LAT", "degrees"],
  ["GPS WP NEXT LON", "degrees"],
];

export async function startSim(onData, { retryMs = 5000 } = {}) {
  let handle;
  const connect = async () => {
    try {
      const res = await open("SkyBound Bridge", Protocol.FSX_SP2);
      handle = res.handle;
      console.log("[sim] connected to", res.recvOpen.applicationName);

      for (const [name, unit] of VARS)
        handle.addToDataDefinition(DEF, name, unit, SimConnectDataType.FLOAT64);

      handle.requestDataOnSimObject(
        REQ, DEF, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND
      );

      handle.on("simObjectData", (recv) => {
        if (recv.requestID !== REQ) return;
        const d = recv.data;                  // RawBuffer; read in definition order
        const t = {
          lat: d.readFloat64(),
          lon: d.readFloat64(),
          altFt: d.readFloat64(),
          gsKt: d.readFloat64(),
          vsFpm: d.readFloat64(),
          wpDistNm: d.readFloat64() / 1852,    // meters -> nm
          wpEteMin: d.readFloat64() / 60,      // s -> min
          destEteMin: d.readFloat64() / 60,
          wpNextLat: d.readFloat64(),
          wpNextLon: d.readFloat64(),
          ts: Date.now(),
        };
        onData(t);
      });

      handle.on("close", () => { console.warn("[sim] disconnected, retrying"); setTimeout(connect, retryMs); });
      handle.on("exception", (e) => console.warn("[sim] exception", e?.exceptionName ?? e));
    } catch (err) {
      console.warn("[sim] not connected (is MSFS running?). retry in", retryMs, "ms");
      setTimeout(connect, retryMs);
    }
  };
  await connect();
  return () => handle?.close?.();
}
