/**
 * Export Module
 * GeoJSON, CSV, and ZIP export functionality
 */

import JSZip from 'jszip';

export class ExportManager {
  static buildGeoJSON(project, captures) {
    const features = captures.map(capture => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [capture.lon, capture.lat, capture.altitude || 0]
      },
      properties: {
        id: capture.id,
        timestamp: capture.timestamp,
        heading_deg: capture.heading.toFixed(1),
        tilt_deg: capture.tilt.toFixed(1),
        hfov_deg: capture.fov,
        gps_accuracy_m: capture.accuracy.toFixed(1),
        kc_stage: capture.kcStage,
        footprint_width_m: capture.footprint?.widthM?.toFixed(1) || null,
        footprint_depth_m: capture.footprint?.depthM?.toFixed(1) || null,
        imgName: `${capture.id}.jpg`
      },
      fov_polygon: capture.footprint?.poly ? {
        type: 'Polygon',
        coordinates: [capture.footprint.poly]
      } : null
    }));

    return {
      type: 'FeatureCollection',
      metadata: {
        app: 'CropView L1',
        version: '2.0.0',
        project: project.name,
        notes: project.notes || '',
        exported: new Date().toISOString(),
        captures: captures.length
      },
      features
    };
  }

  static buildCSV(project, captures) {
    const headers = [
      'id', 'imgName', 'timestamp', 'project', 'lat', 'lon', 'altitude',
      'accuracy_m', 'heading_deg', 'tilt_deg', 'hfov_deg', 'kc_stage',
      'fp_w_m', 'fp_d_m'
    ];

    const rows = captures.map(cap => [
      cap.id,
      `${cap.id}.jpg`,
      cap.timestamp,
      project.name,
      cap.lat.toFixed(6),
      cap.lon.toFixed(6),
      cap.altitude?.toFixed(1) || '',
      cap.accuracy.toFixed(1),
      cap.heading.toFixed(1),
      cap.tilt.toFixed(1),
      cap.fov,
      cap.kcStage || '',
      cap.footprint?.widthM?.toFixed(1) || '',
      cap.footprint?.depthM?.toFixed(1) || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(v => `"${v}"`).join(','))
    ].join('\n');

    return csv;
  }

  static async buildZIP(project, captures) {
    const zip = new JSZip();

    // Add images
    const imgFolder = zip.folder('images');
    for (const capture of captures) {
      if (capture.full) {
        const base64 = capture.full.split(',')[1];
        imgFolder.file(`${capture.id}.jpg`, base64, { base64: true });
      }
    }

    // Add data
    const dataFolder = zip.folder('data');

    // GeoJSON
    const geoJSON = this.buildGeoJSON(project, captures);
    dataFolder.file(
      `${project.name}_captures.geojson`,
      JSON.stringify(geoJSON, null, 2)
    );

    // CSV
    const csv = this.buildCSV(project, captures);
    dataFolder.file(`${project.name}_captures.csv`, csv);

    // Footprints GeoJSON
    const footprints = {
      type: 'FeatureCollection',
      features: captures
        .filter(c => c.footprint?.poly)
        .map(c => ({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [c.footprint.poly]
          },
          properties: {
            capture_id: c.id,
            capture_lat: c.lat,
            capture_lon: c.lon,
            heading_deg: c.heading.toFixed(1),
            kc_stage: c.kcStage,
            timestamp: c.timestamp
          }
        }))
    };

    dataFolder.file(
      `${project.name}_footprints.geojson`,
      JSON.stringify(footprints, null, 2)
    );

    // README
    const readme = `CropView Export — Layer 1 Field Capture Data
Project: ${project.name}
Exported: ${new Date().toISOString()}
Captures: ${captures.length}

CONTENTS:
- images/ : Full-resolution geocoded JPEG photos
- data/
  * _captures.geojson : Capture locations as points
  * _footprints.geojson : FOV ground polygons (for Layer 2)
  * .csv : Tabular summary

NEXT STEP (Layer 2):
Use _footprints.geojson with Sentinel-2 API to:
1. Query satellite scenes within ±15 days
2. Compute NDVI at each footprint location
3. Compare observed Kc vs NDVI-derived stage
`;

    zip.file('README.txt', readme);

    return zip;
  }

  static async downloadZIP(project, captures) {
    const zip = await this.buildZIP(project, captures);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_CropView_${this.dateString()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static downloadGeoJSON(project, captures) {
    const geoJSON = this.buildGeoJSON(project, captures);
    const json = JSON.stringify(geoJSON, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_captures.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static downloadCSV(project, captures) {
    const csv = this.buildCSV(project, captures);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_captures.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static dateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
