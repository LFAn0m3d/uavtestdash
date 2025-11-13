// sim-server.js (no token, pure simulation)
// ----------------------------------------
const WebSocket = require('ws');
const fs = require('fs');

// ================== CONFIG ==================
const PORT = 8765;
const wss = new WebSocket.Server({ port: PORT });
console.log('WS sim running on ws://localhost:' + PORT + '/stream');

// จุดกลาง (กล้อง) - ใกล้ ๆ CRMA
const baseLat = 14.296422;
const baseLon = 101.166061;

// กล้องคงที่
const cameraPos = { lat: baseLat, lon: baseLon };

// ================== LOAD GEO TARGETS (ถ้ามี CSV) ==================
let geoTargets = [];
try {
  const csv = fs.readFileSync('/home/nomad/uav_testdash/geo_predictions (1).csv', 'utf8');
  const lines = csv.split('\n').slice(1); // ข้ามหัวตาราง
  const seen = new Set();
  lines.forEach(function (line) {
    if (!line.trim()) return;
    const parts = line.split(',');
    if (parts.length < 4) return;

    const img = parts[0];
    const latStr = parts[1];
    const lonStr = parts[2];
    const altStr = parts[3];
    const key = latStr.substring(0, 8) + '_' + lonStr.substring(0, 8);

    if (!seen.has(key)) {
      geoTargets.push({
        id: 'target_' + (geoTargets.length + 1),
        lat: parseFloat(latStr),
        lon: parseFloat(lonStr),
        altitude: parseFloat(altStr),
        image: img,
        status: 'detected'
      });
      seen.add(key);
    }
  });
  console.log('✓ Loaded ' + geoTargets.length + ' geo-predicted targets');
} catch (e) {
  console.warn('No geo_predictions CSV loaded:', e.message);
}

// ================== DRONE STATE ==================

// ติดตามการตรวจจับที่ส่งไปแล้วเพื่อหลีกเลี่ยงการส่งซ้ำ
const sentDetections = new Set();

// โดรนศัตรู (attack)
let attackDrones = [
  {
    id: 'attack_01',
    lat: baseLat + 0.20,
    lon: baseLon - 0.25,
    seq: 0,
    dirLat: -0.003,
    dirLon: 0.004,
    battery: 85,
    signal: 88,
    velocity: 12,
    altitude: 200,
    heading: 45
  },
  {
    id: 'attack_02',
    lat: baseLat - 0.15,
    lon: baseLon + 0.22,
    seq: 0,
    dirLat: 0.0035,
    dirLon: -0.0035,
    battery: 78,
    signal: 82,
    velocity: 10,
    altitude: 180,
    heading: 315
  },
  {
    id: 'attack_03',
    lat: baseLat + 0.18,
    lon: baseLon + 0.20,
    seq: 0,
    dirLat: -0.004,
    dirLon: -0.002,
    battery: 92,
    signal: 90,
    velocity: 14,
    altitude: 220,
    heading: 270
  }
];

// โดรนฝ่ายเรา (friendly)
let friendlyDrones = [
  {
    id: 'friendly_01',
    lat: baseLat - 0.05,
    lon: baseLon - 0.05,
    seq: 0,
    phase: 0, // 0: outbound, 1: loitering, 2: returning
    targetLat: baseLat + 0.15,
    targetLon: baseLon + 0.15,
    battery: 95,
    signal: 92,
    velocity: 15,
    altitude: 250,
    heading: 45
  },
  {
    id: 'friendly_02',
    lat: baseLat + 0.02,
    lon: baseLon + 0.03,
    seq: 0,
    phase: 1,
    targetLat: baseLat - 0.10,
    targetLon: baseLon + 0.12,
    battery: 80,
    signal: 85,
    velocity: 12,
    altitude: 200,
    heading: 225
  },
  {
    id: 'friendly_03',
    lat: baseLat - 0.08,
    lon: baseLon + 0.10,
    seq: 0,
    phase: 2,
    targetLat: baseLat,
    targetLon: baseLon,
    battery: 55,
    signal: 78,
    velocity: 16,
    altitude: 180,
    heading: 270
  }
];

// ================== BROADCAST HELPER ==================
function broadcast(obj) {
  const s = JSON.stringify(obj);
  wss.clients.forEach(function (c) {
    if (c.readyState === WebSocket.OPEN) {
      c.send(s);
    }
  });
}

// ================== DRONE MOVEMENT (route_point) ==================
setInterval(function () {
  var now = new Date().toISOString();

  // --- ศัตรู ---
  attackDrones.forEach(function (drone) {
    drone.seq += 1;
    drone.lat += drone.dirLat + (Math.random() - 0.5) * 0.0004;
    drone.lon += drone.dirLon + (Math.random() - 0.5) * 0.0004;

    drone.battery = Math.max(30, drone.battery - Math.random() * 0.3);
    drone.signal = Math.max(40, 100 - Math.random() * 25);
    drone.velocity = 10 + Math.random() * 5;
    drone.altitude = 180 + Math.random() * 60;

    // heading จากเวกเตอร์ dir
    drone.heading = Math.atan2(drone.dirLon, drone.dirLat) * 180 / Math.PI;

    broadcast({
      type: 'route_point',
      data: {
        drone_id: drone.id,
        lat: drone.lat,
        lon: drone.lon,
        seq: drone.seq,
        ts: now,
        battery: drone.battery,
        signal: drone.signal,
        velocity: drone.velocity,
        altitude: drone.altitude,
        heading: drone.heading,
        status: 'active',
        role: 'attack'
      }
    });
  });

  // --- ฝ่ายเรา ---
  friendlyDrones.forEach(function (drone) {
    drone.seq += 1;
    var dLat = drone.targetLat - drone.lat;
    var dLon = drone.targetLon - drone.lon;
    var dist = Math.sqrt(dLat * dLat + dLon * dLon);

    // เปลี่ยน phase
    if (drone.phase === 0 && dist < 0.02) {
      drone.phase = 1; // ถึงเป้าหมาย
    } else if (drone.phase === 1 && Math.random() < 0.1) {
      drone.phase = 2; // เริ่มกลับ
      drone.targetLat = baseLat;
      drone.targetLon = baseLon;
    } else if (drone.phase === 2 && dist < 0.015) {
      drone.phase = 0; // กลับถึงฐาน → ออกไปอีกรอบ
      drone.targetLat = baseLat + 0.15;
      drone.targetLon = baseLon + 0.15;
    }

    // เดินทางเข้าเป้าหมาย
    if (dist > 0.001) {
      var step = 0.003;
      drone.lat += (dLat / dist) * step;
      drone.lon += (dLon / dist) * step;
    }

    // telemetry
    if (drone.phase === 0 || drone.phase === 2) {
      drone.battery = Math.max(30, drone.battery - Math.random() * 0.5);
      drone.velocity = 14 + Math.random() * 3;
    } else {
      drone.battery = Math.max(30, drone.battery - Math.random() * 0.2);
      drone.velocity = 5 + Math.random() * 2;
    }

    drone.signal = Math.max(50, 100 - Math.random() * 20);
    drone.altitude = 150 + Math.random() * 100;
    drone.heading = Math.atan2(dLon, dLat) * 180 / Math.PI;

    var phaseNames = ['outbound', 'loitering', 'returning'];

    broadcast({
      type: 'route_point',
      data: {
        drone_id: drone.id,
        lat: drone.lat,
        lon: drone.lon,
        seq: drone.seq,
        ts: now,
        battery: drone.battery,
        signal: drone.signal,
        velocity: drone.velocity,
        altitude: drone.altitude,
        heading: drone.heading,
        status: phaseNames[drone.phase] || 'active',
        role: 'friendly'
      }
    });
  });
}, 800);

// ================== CAMERA DETECTION (จำลอง) ==================
setInterval(function () {
  var now = new Date().toISOString();

  attackDrones.forEach(function (drone) {
    var dLat = drone.lat - cameraPos.lat;
    var dLon = drone.lon - cameraPos.lon;
    var dist = Math.sqrt(dLat * dLat + dLon * dLon);

    // ถ้าเข้าใกล้กล้องในรัศมีประมาณ 0.08° → ตรวจจับ
    if (dist < 0.08) {
      var conf = 1 - dist * 8;
      if (conf < 0.4) conf = 0.4;
      if (conf > 0.99) conf = 0.99;

      // สร้าง key เพื่อติดตามการตรวจจับ
      var detKey = drone.id + ':' + Math.round(drone.lat * 1000) + ':' + Math.round(drone.lon * 1000);
      
      // ส่งเฉพาะถ้ายังไม่ได้ส่งการตรวจจับนี้มาก่อน
      if (!sentDetections.has(detKey)) {
        broadcast({
          type: 'detection',
          data: {
            lat: drone.lat,
            lon: drone.lon,
            ts: now,
            confidence: Number(conf.toFixed(2)),
            source_id: 'sim_camera_01',
            raw_type: 'hostile_uav',
            drone_id: drone.id,
            heading: drone.heading,
            altitude: drone.altitude
          }
        });
        sentDetections.add(detKey);
        
        // ลบจาก set หลังจากนานพอ (5 วินาที) เพื่อให้สามารถตรวจจับใหม่ได้หากโดรนหนีออกไปและกลับมา
        setTimeout(function() { sentDetections.delete(detKey); }, 5000);
      }
    }
  });
}, 1200);

// ================== GEO TARGET BROADCAST (จำลอง) ==================
let targetIndex = 0;
setInterval(function () {
  if (geoTargets.length === 0) return;

  var numToSend = Math.min(10, geoTargets.length);
  for (var i = 0; i < numToSend; i++) {
    var target = geoTargets[targetIndex % geoTargets.length];
    broadcast({
      type: 'target',
      data: {
        target_id: target.id,
        lat: target.lat,
        lon: target.lon,
        altitude: target.altitude,
        image: target.image,
        status: 'detected',
        ts: new Date().toISOString()
      }
    });
    targetIndex++;
  }
}, 15000);

// ================== CLEAR COMMAND จาก controls.html ==================
wss.on('connection', function (ws) {
  console.log('client connected');
  ws.on('message', function (msg) {
    try {
      var data = JSON.parse(msg.toString());
      if (data.type === 'clear') {
        var scope = data.scope || 'all';
        console.log('Clearing ' + scope + ' from WS command');
        broadcast({ type: 'clear', scope: scope });
      }
    } catch (e) {
      console.error('Bad message', e);
    }
  });
});
