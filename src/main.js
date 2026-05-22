/**
 * CropView v2 — Main Application
 * Integrates sensor fusion, camera, map, and export
 */

import { SensorFusion } from './sensor-fusion.js';
import { CameraManager, initCameraDebug } from './camera.js';
import { MapManager, GeometryUtils } from './map.js';
import { ExportManager } from './export.js';

// Global app state
const app = {
  sessionActive: false,
  project: { name: '', notes: '' },
  selectedKc: null,
  captures: [],
  sensors: null,
  camera: null,
  map: null
};

// Initialize app
async function init() {
  console.log('🌱 CropView v2 initializing...');

  // Setup modules
  app.sensors = new SensorFusion();
  app.camera = new CameraManager();
  app.map = new MapManager();

  // Initialize map
  app.map.init('map');

  // Bind UI events
  bindTabEvents();
  bindPermissionEvents();
  bindCameraEvents();
  bindMapEvents();
  bindDataEvents();
  bindExportEvents();
  bindAboutModal();

  // Try to get compass permission on iOS
  await app.sensors.requestCompassPerm();

  // Start sensor fusion loop
  startSensorLoop();

  // Start camera (fallback if not available)
  await app.camera.request();
  if (!app.camera.stream) {
    console.warn('Camera unavailable, using test pattern');
    initCameraDebug();
  }

  console.log('✅ CropView v2 ready');
}

// Sensor fusion update loop
function startSensorLoop() {
  setInterval(() => {
    const state = app.sensors.fuse();

    // Update HUD
    updateHUD(state);
  }, 100); // 10 Hz update
}

// Update heads-up display
function updateHUD(state) {
  const headingEl = document.getElementById('hud-heading');
  const sensorBadge = document.getElementById('sensor-badge');
  const tiltLabel = document.getElementById('tilt-label');

  if (headingEl) {
    headingEl.textContent = state.heading.toFixed(0) + ' °';
  }

  if (tiltLabel) {
    tiltLabel.textContent = state.tilt.toFixed(0) + '°';
  }

  if (sensorBadge) {
    sensorBadge.querySelector('.sensor-source').textContent = state.source;
    sensorBadge.querySelector('.sensor-confidence').textContent = state.confidence + '%';
  }

  // Update compass rose
  const compassRose = document.getElementById('compass-rose');
  if (compassRose) {
    compassRose.style.transform = `rotate(${-state.heading}deg)`;
  }
}

// Tab navigation
function bindTabEvents() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;

      // Deactivate all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Activate selected
      btn.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Update map on switch to map tab
      if (tabName === 'map') {
        setTimeout(() => app.map.map?.invalidateSize(), 100);
      }
    });
  });
}

// Permission handling
function bindPermissionEvents() {
  // Will be called by START SESSION
}

// Camera controls
function bindCameraEvents() {
  const flipBtn = document.getElementById('btn-flip-camera');
  const captureBtn = document.getElementById('btn-capture');
  const toMapBtn = document.getElementById('btn-to-map');

  flipBtn?.addEventListener('click', async () => {
    await app.camera.flipCamera();
  });

  captureBtn?.addEventListener('click', async () => {
    if (!app.sessionActive) {
      alert('Start a session first');
      return;
    }
    await doCapture();
  });

  toMapBtn?.addEventListener('click', () => {
    document.querySelector('[data-tab="map"]').click();
  });

  // Kc stage selector
  const kcBtns = document.querySelectorAll('.kc-btn');
  kcBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      kcBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      app.selectedKc = parseInt(btn.dataset.kc);
    });
  });
}

// Map controls
function bindMapEvents() {
  const centerBtn = document.getElementById('btn-center');
  const satelliteBtn = document.getElementById('btn-satellite');
  const footprintsBtn = document.getElementById('btn-footprints');
  const toCameraBtn = document.getElementById('btn-to-camera');

  centerBtn?.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(pos => {
      app.map.center(pos.coords.latitude, pos.coords.longitude);
    });
  });

  satelliteBtn?.addEventListener('click', () => {
    app.map.toggleSatellite();
  });

  footprintsBtn?.addEventListener('click', () => {
    app.map.toggleFootprints();
  });

  toCameraBtn?.addEventListener('click', () => {
    document.querySelector('[data-tab="camera"]').click();
  });
}

// Data panel
function bindDataEvents() {
  const startBtn = document.getElementById('btn-start-session');

  startBtn?.addEventListener('click', async () => {
    const name = document.getElementById('project-name').value.trim();
    if (!name) {
      alert('Project name required');
      return;
    }

    app.project.name = name;
    app.project.notes = document.getElementById('project-notes').value;

    // Request permissions
    try {
      // GPS
      navigator.geolocation.watchPosition(
        pos => {
          app.sensors.updateGpsPosition(pos.coords.latitude, pos.coords.longitude);
          app.sensors.setMagneticDeclination(pos.coords.latitude, pos.coords.longitude);

          // Update HUD and map
          const hud = document.getElementById('hud-gps');
          if (hud) {
            hud.textContent = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}, ${pos.coords.altitude?.toFixed(0) || '--'}m`;
          }

          const accuracy = document.getElementById('hud-accuracy');
          if (accuracy) {
            const acc = pos.coords.accuracy.toFixed(0);
            const status = acc < 10 ? '✓' : acc < 20 ? '~' : '⚠';
            accuracy.textContent = `${status} ${acc}m`;
          }

          // Update live data panel
          document.getElementById('data-lat').textContent = pos.coords.latitude.toFixed(6);
          document.getElementById('data-lon').textContent = pos.coords.longitude.toFixed(6);
          document.getElementById('data-alt').textContent = (pos.coords.altitude || 0).toFixed(1) + 'm';
          document.getElementById('data-gps-acc').textContent = pos.coords.accuracy.toFixed(1) + 'm';

          // Update map
          app.map.updatePosition(pos.coords.latitude, pos.coords.longitude);
        },
        err => console.warn('GPS error:', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );

      app.sessionActive = true;

      // Show live data section
      document.getElementById('live-data').style.display = 'block';
      document.getElementById('capture-list').style.display = 'block';
      document.getElementById('export-section').style.display = 'block';

      // Hide project setup
      document.querySelector('.data-section').style.display = 'none';

      alert('Session started! Allow GPS & orientation permissions when prompted.');
    } catch (err) {
      console.error('Permission error:', err);
    }
  });
}

// Capture functionality
async function doCapture() {
  const state = app.sensors.getState();
  const { thumb, full } = await app.camera.captureFrame();

  const capture = {
    id: `CV-${Date.now()}`,
    timestamp: new Date().toISOString(),
    lat: 0,
    lon: 0,
    altitude: 0,
    accuracy: 0,
    heading: state.heading,
    tilt: state.tilt,
    fov: 65, // Default, should be device-specific
    kcStage: app.selectedKc,
    footprint: null,
    thumb,
    full
  };

  // Get current GPS position
  navigator.geolocation.getCurrentPosition(pos => {
    capture.lat = pos.coords.latitude;
    capture.lon = pos.coords.longitude;
    capture.altitude = pos.coords.altitude || 0;
    capture.accuracy = pos.coords.accuracy;

    // Compute footprint polygon
    capture.footprint = GeometryUtils.computeFootprint(
      capture.lat,
      capture.lon,
      capture.heading,
      capture.tilt,
      capture.fov
    );

    // Store capture
    app.captures.push(capture);
    localStorage.setItem('cv_captures', JSON.stringify(app.captures));

    // Update UI
    updateCaptureCount();
    app.map.addCapture(capture);

    // Update data panel
    const container = document.getElementById('captures-container');
    const thumb_el = document.createElement('div');
    thumb_el.className = 'capture-thumb';
    thumb_el.innerHTML = `
      <img src="${capture.thumb}" alt="${capture.id}">
      <div>
        <strong>${capture.id}</strong><br>
        Kc${capture.kcStage} • ${capture.heading.toFixed(0)}°
      </div>
    `;
    container?.appendChild(thumb_el);

    console.log('✓ Captured', capture.id);
  });
}

function updateCaptureCount() {
  const count = app.captures.length;
  document.getElementById('capture-count').textContent = count + ' capture' + (count !== 1 ? 's' : '');
  document.getElementById('capture-count-detail').textContent = count;
}

// Export events
function bindExportEvents() {
  document.getElementById('btn-export-zip')?.addEventListener('click', async () => {
    if (app.captures.length === 0) {
      alert('No captures to export');
      return;
    }
    await ExportManager.downloadZIP(app.project, app.captures);
  });

  document.getElementById('btn-export-geojson')?.addEventListener('click', () => {
    if (app.captures.length === 0) {
      alert('No captures to export');
      return;
    }
    ExportManager.downloadGeoJSON(app.project, app.captures);
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    if (app.captures.length === 0) {
      alert('No captures to export');
      return;
    }
    ExportManager.downloadCSV(app.project, app.captures);
  });

  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (confirm('Clear all captures? This cannot be undone.')) {
      app.captures = [];
      localStorage.removeItem('cv_captures');
      app.map.clear();
      document.getElementById('captures-container').innerHTML = '';
      updateCaptureCount();
    }
  });
}

// About modal
function bindAboutModal() {
  const aboutBtn = document.getElementById('btn-about');
  const modal = document.getElementById('about-modal');
  const closeBtn = document.getElementById('btn-close-about');

  aboutBtn?.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Load persisted captures on startup
function loadCaptures() {
  const stored = localStorage.getItem('cv_captures');
  if (stored) {
    app.captures = JSON.parse(stored);
    updateCaptureCount();
  }
}

// Startup
document.addEventListener('DOMContentLoaded', () => {
  loadCaptures();
  init();
});
