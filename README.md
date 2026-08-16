# 🌱 CropView v2

**Geo-tagged field crop capture — directionality rebuild.**

A free, open-source single-file PWA for field researchers and agronomists. Point your phone at a crop; capture its location, heading, and ground field-of-view; match it to satellite data.

**Version 2.0.1** · Layer 1 of 3 · MIT License

---

## Changelog

- **2.0.1** — Fixed `cropview-zip-uploader.html`'s Rotation Offset control rotating the footprint polygon opposite to the azimuth arrow/FOV cone, causing them to diverge whenever a non-zero offset was applied.
- **2.0.0** — Directionality rebuild (see below).

---

## What v2 fixes

v1's FOV polygon pointed the wrong way. The cause was **not** the `+180°` offset everyone blamed — that offset was a band-aid hiding the real bug:

| # | v1 flaw | v2 fix |
|---|---------|--------|
| 1 | Android `deviceorientationabsolute.alpha` increases **counter-clockwise**, but v1 used it raw — mirroring every Android heading. | Heading corrected per platform: `(360 − alpha)` on Android, `webkitCompassHeading` on iOS, plus screen-orientation correction. |
| 2 | `calcPoly` added `(az + 180) % 360` — a hack that was only correct at the one heading it was tested on. | Offset **removed**. The polygon projects along the true fused heading. |
| 3 | Heading came from a single (buggy) compass with no cross-check. | **GPS movement bearing** fusion — when you walk ≥3 m, `turf.bearing()` gives a geometrically-true heading that also auto-calibrates the compass. |

### Why not raw Magnetometer?

The Generic Sensor API `Magnetometer` returns a raw magnetic vector. `atan2(y, x)` from it is **not tilt-compensated** — and you tilt the phone 30–50° for every capture, so a raw-magnetometer heading would be badly wrong. `deviceorientationabsolute` is the OS already fusing **gyroscope + accelerometer + magnetometer** with tilt compensation. That OS fusion, combined with GPS bearing, is the correct and most reliable heading source — so that's what v2 uses.

---

## Heading fusion

```
compass  = platform-corrected deviceorientationabsolute  (gyro+accel+mag, OS-fused)
gpsBear  = turf.bearing(prevFix, currFix)   when moved ≥ 3 m, accuracy < 25 m

heading  = gpsBear        if a GPS bearing was seen in the last 6 s   [SRC: GPS MOVE]
         = compass + cal  otherwise                                  [SRC: COMPASS·CAL]

cal      = running offset between GPS truth and compass (auto-calibration)
```

The active source is shown live in the HUD (`SRC` badge) and the Data tab, and is written into every exported feature as `heading_source`.

---

## Quick start

It's a single file — no build step.

```bash
# serve locally (sensors need HTTPS or localhost)
npx serve .
```

Or just open the GitHub Pages URL on your phone:
`https://somdeepkundu.github.io/cropview-v2`

**Flow:** Grant permissions → name the project session → capture.

---

## Export

- **Points GeoJSON** — capture locations, with `heading_deg`, `heading_source`, `kc_stage`, footprint dimensions, and the `fov_polygon`.
- **Footprints GeoJSON** — FOV ground polygons (the Layer 2 input for satellite pixel sampling).
- **CSV** — tabular summary.
- **ZIP** — geocoded JPEGs + all data + README.

---

## Files

```
index.html             ← the entire app (self-contained)
manifest.json          ← PWA manifest
index.html.v1-backup   ← original v1, kept for reference
```

---

## Credits

**Somdeep Kundu** — PhD Research Scholar, RuDRA Lab, C-TARA, IIT Bombay.
Developed for the RGSTC Project, Maharashtra Government.
📧 somdeep@iitb.ac.in · 🌐 [somdeepkundu.github.io](https://somdeepkundu.github.io)

MIT License © 2026 Somdeep Kundu
