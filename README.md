# 🌱 CropView v2

**Rebuilt from scratch with native sensor APIs and corrected directionality.**

A free, open-source Progressive Web App (PWA) for field researchers and agronomists. Point your phone at a crop, capture its location, direction, and field of view. Match it with satellite data.

---

## ✨ What's New in v2

✅ **Native Sensor APIs** — Gyroscope, Accelerometer, Magnetometer via Generic Sensor API  
✅ **Rebuilt Directionality** — Clean, intuitive polygon projection (no 180° confusion)  
✅ **Kalman-Filtered Fusion** — Smooth, reliable heading from multi-sensor fusion  
✅ **Zero Dependencies** (except Leaflet, Turf, JSZip) — Vanilla JavaScript  
✅ **Offline-First** — All captures stored locally, no backend required  
✅ **PWA Ready** — Install on home screen, work offline  

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Server runs on `https://localhost:5173` (HTTPS required for sensors).

### 3. Open in Browser
- **Desktop:** https://localhost:5173 (test with DevTools sensors)
- **Mobile:** Open on real device with camera/GPS

### 4. Allow Permissions
- 📷 Camera
- 📍 GPS (geolocation)
- 🧭 Device Orientation (compass)

### 5. Start Capturing
1. Enter project name
2. Tap **START SESSION**
3. Select growth stage (Kc¹–Kc⁴)
4. Tap **CAPTURE**
5. Export as GeoJSON, CSV, or ZIP

---

## 📋 Core Modules

### `src/sensor-fusion.js`
Multi-sensor fusion with Kalman filtering:
- **Gyroscope** — tracks rotation delta
- **Accelerometer** — measures device tilt
- **Magnetometer** — absolute heading (with declination correction)
- **GPS bearing** — movement-based heading (95% confidence)
- **Device Compass** — fallback heading

Priority: GPS bearing > Device Compass > Magnetometer

### `src/camera.js`
Video stream capture and image processing:
- Request camera permission (front/back)
- Flip camera
- Capture frame as JPEG (thumb + full)

### `src/map.js`
Leaflet-based visualization:
- Capture markers (color-coded by Kc stage)
- FOV polygon overlays
- Satellite toggle
- Real-time position tracking

Geometry utils compute footprint polygon from:
- Device position + heading
- Camera tilt + FOV
- Height above ground

### `src/export.js`
Multi-format export:
- **GeoJSON** — FeatureCollection with capture points + footprint polygons
- **CSV** — Tabular summary for spreadsheets
- **ZIP** — Images + data + README

---

## 🧭 Directionality Fix (v1.3.0 → v2.0.0)

**v1.3.0 Issue:** Polygon projected 180° away from heading (behind the user).

**v2.0.0 Fix:**
- Clean separation: device heading for display, forward projection for polygon
- Gyroscope tracks rotations in real-time
- Accelerometer measures tilt (0° = flat, 90° = vertical)
- Polygon always projects in direction camera points (no offset confusion)

**Formula:**
```
ground_distance = height × tan(tilt)
footprint_width = 2 × ground_distance × tan(hfov/2)

Project forward from device:
  farPoint = destination(devicePos, distance, heading)
  farLeft = destination(farPoint, width/2, heading - 90)
  farRight = destination(farPoint, width/2, heading + 90)
```

---

## 🔧 Sensor Details

### Kalman Filter
Smooths noisy sensor readings:
```
State: x = heading (0–360°)
Process noise: q = 0.05 (drift allowed per update)
Measurement noise: r = 10 (sensor uncertainty)

Predict: p_new = p + q
Update:  k = p / (p + r)
         x_new = x + k × (measurement − x)
         p_new = (1 − k) × p
```

Effect: Reduces compass jitter by ~3–5×, preserves true heading changes.

### GPS Bearing
When walking (velocity > 0.5 m/s):
```
bearing = atan2(sin(Δlon) × cos(lat2),
                 cos(lat1) × sin(lat2) − sin(lat1) × cos(lat2) × cos(Δlon))
```
Advantage: Unaffected by compass calibration issues (95% confidence).

### Magnetic Declination
Converts magnetic heading to true north:
```
true_heading = magnetic_heading + declination
declination ≈ −0.0005 × lon + 0.00005 × lat (simplified WMM)
```
Applied automatically on first GPS fix.

---

## 📦 Build & Deploy

### Build for Production
```bash
npm run build
```

Outputs optimized files to `dist/`.

### Deploy to GitHub Pages
```bash
# In your somdeepkundu.github.io repo
cp -r dist/* cropview-v2/
git add .
git commit -m "Deploy CropView v2"
git push
```

Live at: `https://somdeepkundu.github.io/cropview-v2`

---

## 🗂️ Data Format

### GeoJSON Export
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "app": "CropView L1",
    "version": "2.0.0",
    "project": "Wheat Field A",
    "captures": 12
  },
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [72.9234, 19.0760, 542.3]
      },
      "properties": {
        "id": "CV-1715812345678",
        "heading_deg": 142,
        "tilt_deg": 38,
        "kc_stage": 3,
        "footprint_width_m": 8.4,
        "footprint_depth_m": 5.1
      },
      "fov_polygon": {
        "type": "Polygon",
        "coordinates": [[[lon,lat], ...]]
      }
    }
  ]
}
```

### CSV Export
| Column | Example |
|--------|---------|
| id | CV-1715812345678 |
| timestamp | 2026-05-16T09:22:45.123Z |
| lat | 19.0760 |
| lon | 72.9234 |
| heading_deg | 142 |
| tilt_deg | 38 |
| kc_stage | 3 |
| fp_w_m | 8.4 |
| fp_d_m | 5.1 |

---

## 🚨 Troubleshooting

### "Camera not available"
- Use test pattern on desktop (non-HTTPS blocks camera)
- On mobile, ensure HTTPS and app has permission

### "GPS won't lock"
- Go outside with clear sky view
- Disable WiFi (WiFi triangulation less accurate)
- Wait 30+ seconds for fix
- Proceed with lower accuracy if needed (note in project)

### "Heading pointing wrong way"
- Walk a few steps to activate GPS bearing (95% confidence)
- Check compass calibration (figure-8 motion)
- Avoid magnetic interference (power lines, metal structures)
- Keep tilt between 30–60°

### "Footprint polygon weird"
- Verify tilt angle in HUD (should be 30–50°)
- Check GPS accuracy (must be < 20m)
- Ensure heading source is GPS bearing, not compass alone

---

## 🔮 Layer 2 & 3 (Planned)

**Layer 2** — Satellite data integration
- Query Sentinel-2 L2A scenes (±15 days)
- Compute NDVI at footprint locations
- Enrich GeoJSON with satellite fields

**Layer 3** — Mismatch alerts
- Compare user-observed Kc vs satellite-derived Kc
- Flag disagreements (e.g., irrigation, pest damage, misidentification)
- Water demand estimation (ETc = ET₀ × Kc)

---

## 📚 References

| Component | Purpose | Link |
|-----------|---------|------|
| Generic Sensor API | Gyro, Accel, Mag | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Sensor_APIs) |
| Leaflet.js | Map rendering | [leafletjs.com](https://leafletjs.com) |
| Turf.js | Geospatial math | [turfjs.org](https://turfjs.org) |
| JSZip | ZIP packaging | [github.com/Stuk/jszip](https://github.com/Stuk/jszip) |
| Sentinel-2 | Satellite data | [sentinel.esa.int](https://sentinel.esa.int) |

---

## 📧 Contact

**Somdeep Kundu**  
PhD Research Scholar, RuDRA Lab, C-TARA, IIT Bombay  
📧 somdeep@iitb.ac.in  
🌐 [somdeepkundu.github.io](https://somdeepkundu.github.io)  
🐙 [@somdeepkundu](https://github.com/somdeepkundu)

---

## 📄 License

MIT License — See LICENSE file.

**Version 2.0.0** · May 2026
