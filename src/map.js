/**
 * Map Module
 * Leaflet-based map visualization for captures and footprints
 */

const turf = window.turf;

export class MapManager {
  constructor() {
    this.map = null;
    this.markers = new Map();
    this.footprints = new Map();
    this.currentPosMarker = null;
    this.satelliteLayer = null;
    this.showFootprints = false;
  }

  init(containerId = 'map') {
    // Leaflet is loaded from CDN in HTML
    const L = window.L;
    if (!L) {
      console.error('Leaflet not loaded');
      return;
    }

    // Initialize Leaflet map
    this.map = L.map(containerId).setView([19.0760, 72.8760], 13);

    // OpenStreetMap base layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    });
    osmLayer.addTo(this.map);

    // Satellite layer (not added by default)
    this.satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '© Esri',
        maxZoom: 19
      }
    );

    // Current position marker
    const greenIcon = L.icon({
      iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2388cc33"><circle cx="12" cy="12" r="10" fill="%2388cc33"/><circle cx="12" cy="12" r="6" fill="white"/></svg>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this.currentPosMarker = L.marker([19.0760, 72.8760], { icon: greenIcon });
    this.currentPosMarker.addTo(this.map);
  }

  // Add or update current position
  updatePosition(lat, lon) {
    if (this.currentPosMarker) {
      this.currentPosMarker.setLatLng([lat, lon]);
    }
  }

  // Center map on position
  center(lat, lon) {
    this.map.setView([lat, lon], this.map.getZoom());
  }

  // Toggle satellite view
  toggleSatellite() {
    if (this.map.hasLayer(this.satelliteLayer)) {
      this.map.removeLayer(this.satelliteLayer);
    } else {
      this.satelliteLayer.addTo(this.map);
    }
  }

  // Toggle footprints visibility
  toggleFootprints() {
    this.showFootprints = !this.showFootprints;
    this.footprints.forEach((layer) => {
      if (this.showFootprints) {
        this.map.addLayer(layer);
      } else {
        this.map.removeLayer(layer);
      }
    });
  }

  // Add capture marker
  addCapture(capture) {
    const { id, lat, lon, kcStage, heading } = capture;

    // Kc color mapping
    const kcColors = {
      1: '#ff6b6b', // Initial - red
      2: '#ffd93d', // Development - yellow
      3: '#88cc33', // Mid-season - green
      4: '#ff8c00'  // Late - orange
    };

    const color = kcColors[kcStage] || '#999';

    const icon = L.icon({
      iconUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><circle cx="12" cy="12" r="8" fill="${color}"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([lat, lon], { icon });
    marker.addTo(this.map);
    marker.bindPopup(`
      <strong>Capture ${id}</strong><br>
      Kc Stage: ${kcStage}<br>
      Heading: ${heading.toFixed(1)}°
    `);

    this.markers.set(id, marker);

    // Add footprint
    this.addFootprint(capture);
  }

  // Add footprint polygon
  addFootprint(capture) {
    const { id, lat, lon, heading, footprint } = capture;

    if (!footprint || !footprint.poly) return;

    // Build polygon from capture coordinates
    const poly = L.polygon(
      footprint.poly.map(([lng, lat]) => [lat, lng]),
      {
        color: '#88cc33',
        weight: 2,
        opacity: 0.6,
        fillOpacity: 0.1,
        dashArray: '5, 5'
      }
    );

    if (!this.showFootprints) {
      poly.remove();
    } else {
      poly.addTo(this.map);
    }

    this.footprints.set(id, poly);
  }

  // Remove capture
  removeCapture(id) {
    if (this.markers.has(id)) {
      this.map.removeLayer(this.markers.get(id));
      this.markers.delete(id);
    }
    if (this.footprints.has(id)) {
      this.map.removeLayer(this.footprints.get(id));
      this.footprints.delete(id);
    }
  }

  // Clear all
  clear() {
    this.markers.forEach((marker) => this.map.removeLayer(marker));
    this.footprints.forEach((poly) => this.map.removeLayer(poly));
    this.markers.clear();
    this.footprints.clear();
  }
}

/**
 * Geometry utilities for footprint polygon generation
 */
export const GeometryUtils = {
  /**
   * Calculate footprint polygon from device position, heading, and camera parameters
   * Assumes a camera frustum projected onto flat ground
   */
  computeFootprint(lat, lon, heading, tilt, hfov, height = 1.5) {
    // Tilt from horizontal (0° = pointing at ground, 90° = horizontal)
    const tiltRad = tilt * Math.PI / 180;
    const headingRad = heading * Math.PI / 180;

    // Distance from device to far edge of footprint
    const groundDistance = height * Math.tan(tiltRad);

    // Horizontal FOV (degrees)
    const hfovRad = hfov * Math.PI / 180;

    // Width of footprint at ground level
    const footprintWidth = 2 * groundDistance * Math.tan(hfovRad / 2);

    // Create polygon using turf.js
    // Project forward in heading direction
    const devicePoint = turf.point([lon, lat]);
    const farPoint = turf.destination(
      devicePoint,
      groundDistance / 1000, // km
      heading
    );

    // Offset left and right
    const farLeft = turf.destination(
      farPoint,
      footprintWidth / 2 / 1000,
      heading - 90
    );
    const farRight = turf.destination(
      farPoint,
      footprintWidth / 2 / 1000,
      heading + 90
    );

    // Near edge (at device position, smaller)
    const nearWidth = footprintWidth * 0.3;
    const nearLeft = turf.destination(
      devicePoint,
      nearWidth / 2 / 1000,
      heading - 90
    );
    const nearRight = turf.destination(
      devicePoint,
      nearWidth / 2 / 1000,
      heading + 90
    );

    // Build polygon ring
    const poly = [
      nearLeft.geometry.coordinates,
      farLeft.geometry.coordinates,
      farRight.geometry.coordinates,
      nearRight.geometry.coordinates,
      nearLeft.geometry.coordinates // close
    ];

    return {
      poly,
      widthM: footprintWidth,
      depthM: groundDistance
    };
  }
};
