/* FSUIPC7 telemetry reader
   Uses fsuipc npm package — reads offsets directly from FSUIPC7 shared memory.
   Fallback: if FSUIPC7 not available, throws so caller can fall back to SimConnect. */

// FSUIPC7 offsets (hex) for common vars
// Ref: http://www.fsuipc.com/index_files/FSUIPC7_Offsets_Status.pdf
const OFFSETS = {
  lat:        { addr: 0x0560, type: "int64" },   // Latitude  × 10032710144 → degrees
  lon:        { addr: 0x0568, type: "int64" },   // Longitude × 4294967296 × (360/65536/65536) → degrees
  altFt:      { addr: 0x0574, type: "int32" },   // Altitude in metres × 65536 → convert to ft
  gsKt:       { addr: 0x02B4, type: "int32" },   // Ground speed in m/s × 65536 → knots
  vsFpm:      { addr: 0x030C, type: "int32" },   // VS in ft/min × 256
  heading:    { addr: 0x0580, type: "uint32" },  // True heading × 65536 → degrees
  onGround:   { addr: 0x0366, type: "int16" },   // 1 = on ground
};

export async function startFsuipc(onData, { retryMs = 5000 } = {}) {
  let FSUIPC;
  try {
    const mod = await import("fsuipc");
    FSUIPC = mod.FSUIPC || mod.default?.FSUIPC || mod.default;
  } catch(e) {
    throw new Error("fsuipc npm package not found: " + e.message);
  }

  let running = true;
  let handle = null;

  const connect = async () => {
    while (running) {
      try {
        handle = new FSUIPC();
        await handle.open();
        console.log("[fsuipc] connected to FSUIPC7");

        while (running) {
          try {
            // Build read request
            const req = {};
            Object.entries(OFFSETS).forEach(([k, {addr, type}]) => {
              req[k] = [addr, type];
            });

            const result = await handle.process(req);

            // Convert raw values to usable units
            const lat  = result.lat  / 10032710144;
            const lon  = (result.lon / 4294967296) * (360 / 65536 / 65536) * 4294967296;
            // Simpler lon formula:
            const lonDeg = result.lon * (180 / 2147483648);
            const altFt  = (result.altFt / 65536) * 3.28084;    // m × 65536 → ft
            const gsKt   = (result.gsKt / 65536) * 1.94384;     // m/s × 65536 → knots
            const vsFpm  = result.vsFpm / 256;                    // ft/min × 256

            onData({
              lat, lon: lonDeg, altFt, gsKt, vsFpm,
              onGround: result.onGround === 1,
              ts: Date.now(),
              source: "fsuipc7",
            });

            await new Promise(r => setTimeout(r, 1000));
          } catch(e) {
            console.warn("[fsuipc] read error:", e.message);
            await new Promise(r => setTimeout(r, retryMs));
            break;
          }
        }
      } catch(e) {
        console.warn("[fsuipc] not connected (is FSUIPC7 running?):", e.message);
        await new Promise(r => setTimeout(r, retryMs));
      }
    }
  };

  connect();
  return () => { running = false; handle?.close?.(); };
}
