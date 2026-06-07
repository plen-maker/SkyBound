/* MSFS telemetry via node-simconnect — 1 second polling */
import {
  open, Protocol, SimConnectDataType, SimConnectPeriod, SimConnectConstants,
} from "node-simconnect";

const DEF_FLOAT = 0, REQ_FLOAT = 0;
const DEF_STR   = 1, REQ_STR   = 1;

const VARS = [
  ["PLANE LATITUDE",    "degrees"],
  ["PLANE LONGITUDE",   "degrees"],
  ["PLANE ALTITUDE",    "feet"],
  ["GROUND VELOCITY",   "knots"],
  ["VERTICAL SPEED",    "feet per minute"],
  ["GPS WP DISTANCE",   "meters"],
  ["GPS ETE",           "seconds"],
  ["GPS WP NEXT LAT",   "degrees"],
  ["GPS WP NEXT LON",   "degrees"],
  ["SIM ON GROUND",     "bool"],
];

export async function startSim(onData, { retryMs = 3000 } = {}) {
  let handle;
  const connect = async () => {
    try {
      const res = await open("Xdeck Bridge", Protocol.FSX_SP2);
      handle = res.handle;
      console.log("[sim] connected to", res.recvOpen.applicationName);

      for (const [name, unit] of VARS)
        handle.addToDataDefinition(DEF_FLOAT, name, unit, SimConnectDataType.FLOAT64);

      handle.addToDataDefinition(DEF_STR, "TITLE", null, SimConnectDataType.STRING256);

      handle.requestDataOnSimObject(
        REQ_FLOAT, DEF_FLOAT, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND
      );
      handle.requestDataOnSimObject(
        REQ_STR, DEF_STR, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND
      );

      let aircraftTitle = "";

      handle.on("simObjectData", (recv) => {
        if (recv.requestID === REQ_STR) {
          try { aircraftTitle = recv.data.readString(256).replace(/\0/g, "").trim(); } catch {}
          return;
        }
        if (recv.requestID !== REQ_FLOAT) return;
        const d = recv.data;
        onData({
          lat:         d.readFloat64(),
          lon:         d.readFloat64(),
          altFt:       d.readFloat64(),
          gsKt:        d.readFloat64(),
          vsFpm:       d.readFloat64(),
          wpDistNm:    d.readFloat64() / 1852,
          destEteMin:  d.readFloat64() / 60,
          wpNextLat:   d.readFloat64(),
          wpNextLon:   d.readFloat64(),
          onGround:    d.readFloat64() === 1,
          aircraftTitle,
          ts: Date.now(),
          source: "simconnect",
        });
      });

      handle.on("close", () => {
        console.warn("[sim] disconnected, retrying in", retryMs, "ms");
        setTimeout(connect, retryMs);
      });
      handle.on("exception", (e) => console.warn("[sim] exception", e?.exceptionName ?? e));

    } catch (err) {
      console.warn("[sim] not connected (MSFS running?), retry in", retryMs, "ms");
      setTimeout(connect, retryMs);
    }
  };
  await connect();
  return () => handle?.close?.();
}
