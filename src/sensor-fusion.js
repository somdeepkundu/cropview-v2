/**
 * Sensor Fusion Module
 * Combines Gyroscope, Accelerometer, and Magnetometer
 * into a reliable heading estimate using Kalman filtering
 */

// Kalman Filter for heading (1D scalar)
class KalmanFilter {
  constructor(q = 0.05, r = 10) {
    this.q = q; // Process noise
    this.r = r; // Measurement noise
    this.x = 0; // State (heading)
    this.p = 1; // Covariance
    this.initialized = false;
  }

  update(measurement) {
    if (!this.initialized) {
      this.x = measurement;
      this.initialized = true;
      return measurement;
    }

    // Predict
    this.p = this.p + this.q;

    // Update
    const k = this.p / (this.p + this.r); // Kalman gain
    this.x = this.x + k * this.normalizeHeading(measurement - this.x);
    this.p = (1 - k) * this.p;

    return this.normalizeHeading(this.x);
  }

  normalizeHeading(heading) {
    let h = heading % 360;
    if (h < 0) h += 360;
    return h;
  }
}

// Magnetic declination (simplified WMM)
function getMagneticDeclination(lat, lon) {
  // Simplified World Magnetic Model approximation
  return -0.0005 * lon + 0.00005 * lat;
}

export class SensorFusion {
  constructor() {
    this.kalman = new KalmanFilter();

    // Sensor states
    this.gyroHeading = null;
    this.accelTilt = null;
    this.magnetometerHeading = null;
    this.gpsHeading = null;
    this.compassHeading = null;

    // GPS tracking
    this.prevGpsPos = null;
    this.lastGpsTime = 0;

    // Fused output
    this.fusedHeading = 0;
    this.fusedTilt = 0;
    this.activeSensor = 'none';
    this.confidence = 0;

    // Magnetic declination
    this.magDeclination = 0;
    this.magDeclinationSet = false;

    this.initSensors();
  }

  initSensors() {
    this.initGyroscope();
    this.initAccelerometer();
    this.initMagnetometer();
    this.initCompass();
  }

  // Gyroscope (tracks rotation delta)
  initGyroscope() {
    if (!('Gyroscope' in window)) {
      console.warn('Gyroscope not available');
      return;
    }

    try {
      const gyro = new Gyroscope({ frequency: 60 });
      gyro.addEventListener('reading', (e) => {
        // Gyroscope gives angular velocity in rad/s
        // We use it primarily for rotation tracking
        // Heading integration: heading += z_component * dt
        const dt = 1 / 60; // ~16ms per reading
        this.gyroHeading = (this.gyroHeading || 0) + (e.z * dt * 180 / Math.PI);
        if (this.gyroHeading < 0) this.gyroHeading += 360;
        if (this.gyroHeading >= 360) this.gyroHeading -= 360;
      });
      gyro.addEventListener('error', (e) => console.warn('Gyroscope error:', e));
      gyro.start();
    } catch (e) {
      console.warn('Gyroscope init failed:', e);
    }
  }

  // Accelerometer (tracks tilt/pitch)
  initAccelerometer() {
    if (!('Accelerometer' in window)) {
      console.warn('Accelerometer not available');
      return;
    }

    try {
      const accel = new Accelerometer({ frequency: 60 });
      accel.addEventListener('reading', (e) => {
        // Calculate tilt from acceleration vector
        // x = side-to-side, y = front-to-back, z = up-down
        const pitch = Math.atan2(e.y, Math.sqrt(e.x * e.x + e.z * e.z)) * 180 / Math.PI;
        const roll = Math.atan2(e.x, Math.sqrt(e.y * e.y + e.z * e.z)) * 180 / Math.PI;

        // Device tilt from horizontal (0° = flat, 90° = vertical)
        this.accelTilt = Math.sqrt(pitch * pitch + roll * roll);
      });
      accel.addEventListener('error', (e) => console.warn('Accelerometer error:', e));
      accel.start();
    } catch (e) {
      console.warn('Accelerometer init failed:', e);
    }
  }

  // Magnetometer (absolute heading)
  initMagnetometer() {
    if (!('Magnetometer' in window)) {
      console.warn('Magnetometer not available');
      return;
    }

    try {
      const mag = new Magnetometer({ frequency: 10 });
      mag.addEventListener('reading', (e) => {
        // Magnetic field vector (x, y, z) in µT
        // Heading = atan2(y, x) in the horizontal plane
        let magHeading = Math.atan2(e.y, e.x) * 180 / Math.PI;
        if (magHeading < 0) magHeading += 360;

        // Apply magnetic declination to get true north
        if (this.magDeclinationSet) {
          magHeading = (magHeading + this.magDeclination) % 360;
        }

        this.magnetometerHeading = magHeading;
      });
      mag.addEventListener('error', (e) => console.warn('Magnetometer error:', e));
      mag.start();
    } catch (e) {
      console.warn('Magnetometer init failed:', e);
    }
  }

  // Device Orientation API (compass)
  initCompass() {
    const useAbsolute = () => {
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', (e) => {
          // e.alpha = heading (0 = north, increases clockwise)
          this.compassHeading = e.alpha || 0;
        });
      }
    };

    // iOS requires permission request
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+
      this.requestCompassPermission = async () => {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            useAbsolute();
          }
        } catch (e) {
          console.warn('Compass permission denied:', e);
        }
      };
    } else {
      // Android
      useAbsolute();
    }
  }

  // Request compass permission (iOS)
  async requestCompassPerm() {
    if (this.requestCompassPermission) {
      await this.requestCompassPermission();
    }
  }

  // Update GPS position for bearing calculation
  updateGpsPosition(lat, lon) {
    const now = Date.now();
    const dt = (now - this.lastGpsTime) / 1000; // seconds

    if (this.prevGpsPos && dt > 0) {
      // Calculate bearing from previous position to current
      const lat1 = this.prevGpsPos.lat * Math.PI / 180;
      const lat2 = lat * Math.PI / 180;
      const dLon = (lon - this.prevGpsPos.lon) * Math.PI / 180;

      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      let bearing = Math.atan2(y, x) * 180 / Math.PI;

      // Normalize to 0-360
      bearing = (bearing + 360) % 360;

      this.gpsHeading = bearing;
    }

    this.prevGpsPos = { lat, lon };
    this.lastGpsTime = now;
  }

  // Set magnetic declination from GPS position
  setMagneticDeclination(lat, lon) {
    this.magDeclination = getMagneticDeclination(lat, lon);
    this.magDeclinationSet = true;
  }

  // Fuse all sensors into a single heading estimate
  fuse() {
    let measurement = null;
    let source = 'none';
    let conf = 0;

    // Priority: GPS bearing > Device Compass > Magnetometer > Gyro
    if (this.gpsHeading !== null) {
      measurement = this.gpsHeading;
      source = 'GPS Movement';
      conf = 95;
    } else if (this.compassHeading !== null) {
      measurement = this.compassHeading;
      source = 'Device Compass';
      conf = 70;
    } else if (this.magnetometerHeading !== null) {
      measurement = this.magnetometerHeading;
      source = 'Magnetometer';
      conf = 60;
    } else if (this.gyroHeading !== null) {
      measurement = this.gyroHeading;
      source = 'Gyroscope';
      conf = 40;
    }

    if (measurement !== null) {
      this.fusedHeading = this.kalman.update(measurement);
    }

    this.activeSensor = source;
    this.confidence = conf;

    return {
      heading: this.fusedHeading,
      tilt: this.accelTilt || 0,
      source: source,
      confidence: conf
    };
  }

  // Get current fused state
  getState() {
    return {
      heading: this.fusedHeading,
      tilt: this.accelTilt || 0,
      source: this.activeSensor,
      confidence: this.confidence,
      sensors: {
        gps: this.gpsHeading,
        compass: this.compassHeading,
        magnetometer: this.magnetometerHeading,
        gyro: this.gyroHeading,
        accel: this.accelTilt
      }
    };
  }
}
