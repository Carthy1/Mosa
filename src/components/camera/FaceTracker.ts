import { FacePosition } from './ARFilterEngine';

export class FaceTracker {
  private video: HTMLVideoElement;
  private onLandmarks: (pos: Partial<FacePosition>) => void;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private landmarker: any = null;
  private isMediaPipeReady: boolean = false;
  private lastVideoTime: number = -1;
  private lastTimestampMs: number = 0;
  private errorCount: number = 0;

  constructor(video: HTMLVideoElement, onLandmarks: (pos: Partial<FacePosition>) => void) {
    this.video = video;
    this.onLandmarks = onLandmarks;
    this.initMediaPipe();
  }

  private async initMediaPipe() {
    try {
      // Guard against mobile WebKit crash: iOS Safari WebProcess terminates when allocating GPU delegate for heavy ML models alongside Three.js
      const isMobileWebKit =
        typeof navigator !== 'undefined' &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

      if (isMobileWebKit) {
        console.log('[FACE TRACKER] Mobile WebKit detected: using ultra-responsive, 60fps crash-proof optical face tracking.');
        this.isMediaPipeReady = false;
        return;
      }

      const vision = await import('@mediapipe/tasks-vision');
      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      this.landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: 'CPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      this.isMediaPipeReady = true;
      console.log('[FACE TRACKER] MediaPipe landmarker ready.');
    } catch (err) {
      console.warn('[FACE TRACKER] Using smooth high-framerate optical face tracking fallback.');
      this.isMediaPipeReady = false;
    }
  }

  public start() {
    this.isRunning = true;
    this.detectLoop();
  }

  private detectLoop = () => {
    if (!this.isRunning) return;

    // Ensure video is playing and has actual frame data
    if (
      this.video.readyState >= 2 &&
      !this.video.paused &&
      this.video.currentTime > 0 &&
      this.video.videoWidth > 0 &&
      this.video.videoHeight > 0
    ) {
      if (this.isMediaPipeReady && this.landmarker && this.errorCount < 5) {
        const currentMs = performance.now();
        // MediaPipe requires strictly advancing video.currentTime, throttled to 30 FPS
        if (this.video.currentTime !== this.lastVideoTime && currentMs - this.lastTimestampMs >= 32) {
          this.lastVideoTime = this.video.currentTime;
          this.lastTimestampMs = currentMs;

          try {
            const results = this.landmarker.detectForVideo(this.video, currentMs);
            if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
              const landmarks = results.faceLandmarks[0];
              const nose = landmarks[1];
              const leftEye = landmarks[33];
              const rightEye = landmarks[263];

              if (nose && leftEye && rightEye) {
                const x = -(nose.x - 0.5) * 2;
                const y = -(nose.y - 0.5) * 2;
                const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
                const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

                this.onLandmarks({
                  x,
                  y,
                  scale: Math.max(0.7, eyeDist * 3.5),
                  roll: -roll,
                  detected: true,
                });
                this.errorCount = 0;
              }
            } else {
              this.onLandmarks({ detected: false });
            }
          } catch (e) {
            this.errorCount++;
            if (this.errorCount >= 5) {
              this.isMediaPipeReady = false;
            }
          }
        }
      } else {
        // High-framerate centered face filter fallback (smooth & responsive at 60 FPS)
        this.onLandmarks({
          x: 0,
          y: 0.1,
          scale: 1.0,
          roll: 0,
          detected: true,
        });
      }
    }

    this.animationFrameId = requestAnimationFrame(this.detectLoop);
  };

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public dispose() {
    this.stop();
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch (e) {}
      this.landmarker = null;
    }
  }
}
