/* FSUIPC7 telemetry reader using 'fsuipc' npm package (koesie10/fsuipc-node)
   CommonJS-style require wrapped for ESM compatibility. */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

export async function startFsuipc(onData, { retryMs = 5000 } = {}) {
  let fsuipcMod;
  try {
    fsuipcMod = require("fsuipc");
  } catch(e) {
    throw new Error("fsuipc package not found. Run: npm install fsuipc");
  }

  const { FSUIPC, Type } = fsuipcMod;
  let running = true;

  const connect = async () => {
    while (running) {
      const obj = new FSUIPC();
      try {
        await obj.open();
        console.log("[fsuipc] connected to FSUIPC7 ✓");

        while (running) {
          try {
            obj.add("lat",      0x0560, Type.Int64);
            obj.add("lon",      0x0568, Type.Int64);
            obj.add("altM",     0x0574, Type.Int32);
            obj.add("gsRaw",    0x02B4, Type.Int32);
            obj.add("vsRaw",    0x030C, Type.Int32);
            obj.add("onGround", 0x0366, Type.Int16);
            obj.add("destEte",  0x0C1C, Type.Int32);
            obj.add("title",    0x3D00, Type.String, 256);

            const result = await obj.process();

            // Convert raw FSUIPC values
            const lat    = result.lat * (90.0 / (10001750.0 * 65536.0 * 65536.0));
            const lon    = result.lon * (360.0 / (65536.0 * 65536.0 * 65536.0 * 65536.0));
            const altFt  = (result.altM / 65536) * 3.28084;
            const gsKt   = (result.gsRaw / 65536) * 1.94384;
            const vsFpm  = result.vsRaw / 256;
            const destEteMin = (result.destEte || 0) / 60;
            const aircraftTitle = (result.title || "").replace(/\0/g, "").trim();

            onData({
              lat, lon, altFt, gsKt, vsFpm,
              destEteMin,
              onGround: result.onGround === 1,
              aircraftTitle,
              ts: Date.now(),
              source: "fsuipc7",
            });

            await new Promise(r => setTimeout(r, 1000));
          } catch(e) {
            console.warn("[fsuipc] read error:", e.message);
            break;
          }
        }
      } catch(e) {
        console.warn(`[fsuipc] not connected (FSUIPC7 running?): ${e.message}. retry in ${retryMs}ms`);
      } finally {
        try { await obj.close(); } catch {}
      }
      await new Promise(r => setTimeout(r, retryMs));
    }
  };

  connect();
  return () => { running = false; };
}
