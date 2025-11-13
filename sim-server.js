// sim-server.js – Realistic CRMA UAV Simulation
// ---------------------------------------------------
// จำลองโดรนที่ครม. + กล้องที่มองจาก CRMA มุมมอง 120°
// ใช้ร่วมกับ UI เดิมที่มี type: "route_point", "detection", "clear"

const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

// ===================== CONFIG ======================
const PORT = process.env.PORT ? Number(process.env.PORT) : 8765;
let wss;

try {
  wss = new WebSocket.Server({ port: PORT });
  console.log("WS sim running on ws://localhost:" + PORT + "/stream");
} catch (err) {
  console.error("**** Failed to start WebSocket server ****");
  if (err.code === "EADDRINUSE") {
    console.error("Port " + PORT + " is already in use.");
    console.error("💡 ให้ลองปิดโปรเซสเก่าที่ใช้พอร์ตนี้ หรือรันด้วยคำสั่ง: PORT=8877 node sim-server.js");
  } else {
    console.error(err);
  }
  process.exit(1);
}

// =============== CAMERA / MAP CONFIG ===============
// CRMA coords (ประมาณ): 14°17'41"N, 101°10'11"E → 14.2947 , 101.1670
const CAMERA_LAT = 14.2947;
const CAMERA_LON = 101.1670;

// ทิศยิงออกจากทิศตะวันตกเฉียงใต้ (สมมุติให้ไปทาง SW = 210°)
const CAMERA_FOV_DEG = 120; // มุมมองกล้อง
const MAX_RANGE_KM = 8;     // ระยะตรวจจับสูงสุดโดยประมาณ

// =============== DATA LOADING (TARGETS) ===============
const TARGETS_CSV = path.join(__dirname, "targets.csv");

function loadTargets() {
  if (!fs.existsSync(TARGETS_CSV)) {
    console.warn("[sim] targets.csv not found, using empty target list");
    return [];
  }

  const raw = fs.readFileSync(TARGETS_CSV, "utf8").trim();
  const lines = raw.split(/\r?\n/);
  const header = lines.shift(); // ทิ้งหัวตาราง

  return lines
    .map((line) => line.split(","))
    .filter((cols) => cols.length >= 4)
    .map((cols, idx) => {
      const [idRaw, latRaw, lonRaw, levelRaw] = cols;
      return {
        id: idRaw || `T-${idx + 1}`,
        lat: Number(latRaw),
        lon: Number(lonRaw),
        level: levelRaw || "medium",
      };
    })
    .filter((t) => !Number.isNaN(t.lat) && !Number.isNaN(t.lon));
}

let targets = loadTargets();
console.log(`[sim] loaded ${targets.length} geo-predicted targets`);

// =============== BROADCAST HELPERS ===================
function broadcast(obj) {
  const payload = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// =============== SIMPLE SIM LOOP =====================
let tick = 0;

function stepSimulation() {
  tick++;

  // 1) ส่ง heartbeat ให้ dashboard รู้ว่ายังออนไลน์อยู่
  broadcast({
    type: "heartbeat",
    ts: Date.now(),
    tick,
  });

  // 2) ทุก ๆ 5 tick ส่ง detection 1–3 จุดแบบสุ่ม
  if (targets.length > 0 && tick % 5 === 0) {
    const n = 1 + Math.floor(Math.random() * 3);
    const selected = [];

    for (let i = 0; i < n; i++) {
      const t = targets[Math.floor(Math.random() * targets.length)];
      selected.push({
        id: t.id,
        lat: t.lat + (Math.random() - 0.5) * 0.01,
        lon: t.lon + (Math.random() - 0.5) * 0.01,
        level: t.level,
      });
    }

    broadcast({
      type: "detection_batch",
      ts: Date.now(),
      camera: {
        lat: CAMERA_LAT,
        lon: CAMERA_LON,
        fov_deg: CAMERA_FOV_DEG,
        max_range_km: MAX_RANGE_KM,
      },
      detections: selected,
    });

    console.log(
      `[sim] tick=${tick} sent ${selected.length} detections to ${wss.clients.size} clients`
    );
  }
}

// interval 1 วินาที
setInterval(stepSimulation, 1000);

// handle connection ใหม่
wss.on("connection", (socket) => {
  console.log("[sim] client connected, total =", wss.clients.size);
  socket.send(
    JSON.stringify({
      type: "welcome",
      ts: Date.now(),
      message: "CRMA UAV sim server ready",
      camera: {
        lat: CAMERA_LAT,
        lon: CAMERA_LON,
        fov_deg: CAMERA_FOV_DEG,
        max_range_km: MAX_RANGE_KM,
      },
    })
  );

  socket.on("close", () => {
    console.log("[sim] client disconnected, total =", wss.clients.size);
  });
});

process.on("SIGINT", () => {
  console.log("\n[sim] shutting down server...");
  wss.close(() => {
    process.exit(0);
  });
});
