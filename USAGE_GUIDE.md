# UAV Tactical Dashboard — Usage Guide

## System Overview

The dashboard now displays **three distinct tactical views** for monitoring drone operations:

---

## 📡 **http://0.0.0.0:8000/camera.html** — Camera Detection Stream

### Purpose
Shows **incoming hostile/attack drones** as detected by the fixed camera at map center.

### What You See
- **Trajectory Lines**: Red dashed lines showing attack drone flight paths (last 20 waypoints)
- **Direction Arrows**: Triangular arrows (🔺) pointing in the direction of drone movement
- **Detection Points**: Red circles marking detected drone positions
- **Heading & Altitude**: Hover over detection points to see:
  - Drone ID (e.g., `attack_01`)
  - Heading (compass direction 0-360°)
  - Altitude (height in meters)
  - Confidence level (0-1)

### Scenario
3 attack drones flying through the area from different directions, detected when within 8-9km radius of camera.

**Current Attack Drones:**
- `attack_01`: Approaching from NW, heading ~45°
- `attack_02`: Approaching from SE, heading ~315°
- `attack_03`: Approaching from SW, heading ~270°

---

## 🎯 **http://0.0.0.0:8000/offense.html** — Friendly Drone Operations

### Purpose
Shows **offensive operations** of friendly/allied drones executing attack and return missions.

### What You See
- **Green Path Lines**: Routes of friendly drones planning to attack enemy territory
- **Animated Drone Icons**: Green drone symbols with status-based coloring:
  - 🟢 **Green**: Good battery (>60%)
  - 🟠 **Orange**: Medium battery (40-60%)
  - 🔴 **Red**: Low battery (<40%)
- **Status Badges** showing mission phase:
  - 🚀 **Outbound**: Flying to target
  - 🎯 **Loitering**: At target location
  - 🏠 **Returning**: Flying back to base
  - ✈ **Active**: General status
- **Detailed Status Tooltip** (click/hover drone):
  - Drone ID & mission phase
  - 🔋 Battery percentage
  - 📡 Signal strength (%)
  - ⚡ Velocity (m/s)
  - 📏 Altitude (meters)

### Scenario
3 friendly drones with different mission phases:
- `friendly_01`: Outbound to target (95% battery, approaching target area)
- `friendly_02`: Loitering at target (80% battery, in attack area)
- `friendly_03`: Returning to base (55% battery, heading home)

All routes start/end at camera position (Saraburi, central Thailand).

---

## 🛡️ **http://0.0.0.0:8000/index.html** — Main Command Dashboard

### Purpose
**Unified tactical view** of friendly drone operations (no hostile drones shown).

### What You See

#### Three-Panel Layout:

1. **Tactical Map** (60% of screen):
   - Shows **only friendly drone routes** (in green)
   - Camera icon at center (cyan 📹)
   - Flight paths with dashed trail effects
   - Animated drone icons showing current positions
   - Routes display last 20-50 waypoints per drone

2. **Alert Status Panel**:
   - **Last Alert**: Timestamp & details of most recent detection
   - **Latest Detections**: 2 most recent hostile detections with:
     - ⚠️ Detection type (hostile/friendly)
     - 📍 Coordinates
     - 📊 Confidence level

3. **Active Offense Panel** (right sidebar):
   - Lists all active offensive drones with full telemetry:
     - 🔋 Battery status (color-coded)
     - 📡 Signal strength
     - ⚡ Velocity
     - 📏 Altitude
     - Status indicator

### Key Features
- Real-time WebSocket updates every 800ms
- All friendly drones shown in green
- No hostile drone information displayed (kept on camera.html)
- Drone animation with gentle bobbing motion
- Status color indicators for quick decision-making

---

## 🔗 How They Work Together

```
INCOMING THREATS           FRIENDLY OPERATIONS        COMMAND CENTER
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  camera.html         │   │  offense.html        │   │  index.html          │
├──────────────────────┤   ├──────────────────────┤   ├──────────────────────┤
│ • Attack drones 🔴   │   │ • Friendly drones 🟢 │   │ • Friendly routes 🟢 │
│ • Trajectories       │   │ • Mission phases     │   │ • Status alerts      │
│ • Direction/Altitude │   │ • Full telemetry     │   │ • Offense operations │
│ • Detection range    │   │ • Return trajectories│   │ • Command overview   │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
         ↓                           ↓                          ↓
   Military cameras            Offensive units           Command center
   track enemy                deploy against             views own forces
   movements                   enemy territory           only
```

---

## 📊 Drone Telemetry Legend

| Indicator | Color | Meaning |
|-----------|-------|---------|
| 🔋 Battery | 🟢 Green | >70% (Good) |
| | 🟠 Orange | 40-70% (Medium) |
| | 🔴 Red | <40% (Critical) |
| 📡 Signal | 🟢 Green | >75% (Strong) |
| | 🟠 Orange | 50-75% (Medium) |
| | 🔴 Red | <50% (Weak) |
| ⚡ Velocity | 📈 Blue | Flight speed in m/s |
| 📏 Altitude | 📈 Blue | Height in meters AGL |

---

## 🚀 WebSocket Message Flow

### Simulator sends:

**Attack Drones** (every 800ms):
```json
{
  "type": "route_point",
  "data": {
    "drone_id": "attack_01",
    "role": "attack",
    "lat": 14.30, "lon": 101.20,
    "battery": 80, "signal": 85,
    "velocity": 12, "altitude": 200,
    "heading": 45, "status": "active"
  }
}
```

**Friendly Drones** (every 800ms):
```json
{
  "type": "route_point",
  "data": {
    "drone_id": "friendly_01",
    "role": "friendly",
    "lat": 14.30, "lon": 101.18,
    "battery": 90, "signal": 90,
    "velocity": 15, "altitude": 250,
    "heading": 45, "status": "outbound"
  }
}
```

**Detections** (every 1200ms when attack drones in range):
```json
{
  "type": "detection",
  "data": {
    "drone_id": "attack_01",
    "lat": 14.295, "lon": 101.165,
    "heading": 45, "altitude": 200,
    "confidence": 0.95,
    "raw_type": "hostile_uav"
  }
}
```

---

## 🔧 Testing the System

### Start Services:
```bash
cd /home/nomad/uav_testdash
node sim-server.js &          # Start WebSocket simulator
python3 -m http.server 8000 & # Start HTTP server
```

### Access Dashboards:
- **Camera View**: http://localhost:8000/camera.html
- **Offense View**: http://localhost:8000/offense.html
- **Command Dashboard**: http://localhost:8000/index.html

### Watch Real-Time Updates:
- All drones update every 800ms
- Detections broadcast every 1200ms
- All pages sync via single WebSocket stream

---

## 📝 Notes

- **Role Separation**: Attack drones (red/hostile) only show on camera.html; friendly drones (green) show on offense.html and index.html
- **Battery Simulation**: Depletes realistically during flight phases
- **Signal Quality**: Varies based on distance and interference
- **Animation**: Drones bob gently to indicate active flight
- **Trail Effect**: Last 5 waypoints shown with gradient fade on drone icons

---

**Version**: 1.0  
**Last Updated**: November 13, 2025  
**Simulator**: WebSocket-based real-time data stream
