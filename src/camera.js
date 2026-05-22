/**
 * Camera Module
 * Handles video stream capture and image processing
 */

export class CameraManager {
  constructor() {
    this.stream = null;
    this.videoEl = document.getElementById('camera-feed');
    this.facingMode = 'environment'; // back camera
  }

  async request() {
    try {
      // Request camera permission
      const constraints = {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoEl.srcObject = this.stream;

      return { success: true };
    } catch (error) {
      console.error('Camera error:', error);
      return { success: false, error: error.message };
    }
  }

  async flipCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    return this.request();
  }

  // Capture current video frame as image
  async captureFrame() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = this.videoEl.videoWidth;
      canvas.height = this.videoEl.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoEl, 0, 0);

      // Thumbnail (40% quality)
      const thumb = canvas.toDataURL('image/jpeg', 0.4);

      // Full (85% quality)
      const full = canvas.toDataURL('image/jpeg', 0.85);

      resolve({ thumb, full });
    });
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}

// For easier debugging and development
export function initCameraDebug() {
  const video = document.getElementById('camera-feed');
  if (!video) {
    console.warn('Video element not found');
    return;
  }

  // Fallback test pattern if camera not available
  if (!video.srcObject) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      const drawPattern = () => {
        ctx.fillStyle = '#2d5016';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#88cc33';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Camera not available', 320, 240);
        ctx.fillText('(using test pattern)', 320, 270);
        requestAnimationFrame(drawPattern);
      };

      drawPattern();
      video.srcObject = canvas.captureStream(30);
      console.log('Test pattern initialized');
    } catch (e) {
      console.error('Test pattern error:', e);
      // Show a static message instead
      video.style.background = '#2d5016';
      video.style.display = 'flex';
      video.style.alignItems = 'center';
      video.style.justifyContent = 'center';
      video.style.color = '#88cc33';
      video.style.fontSize = '20px';
      video.textContent = '📷 Camera not available';
    }
  }
}
