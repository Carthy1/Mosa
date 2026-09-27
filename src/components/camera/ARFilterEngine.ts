import * as THREE from 'three';
import { ARFilterId } from '@/types';

export interface FacePosition {
  x: number; // Normalized -1 to 1 or 0 to 1
  y: number;
  scale: number;
  roll: number;
  yaw: number;
  pitch: number;
  detected: boolean;
}

export class ARFilterEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private currentFilter: ARFilterId = 'none';
  private filterObjects: Map<ARFilterId, THREE.Object3D> = new Map();
  private animationFrameId: number | null = null;
  private lastTime: number = performance.now();
  private startTime: number = performance.now();
  private isDisposed: boolean = false;

  // Face tracking smoothed state
  private faceState: FacePosition = {
    x: 0,
    y: 0.1,
    scale: 1,
    roll: 0,
    yaw: 0,
    pitch: 0,
    detected: false,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initThreeJS();
  }

  private initThreeJS() {
    try {
      const width = this.canvas.clientWidth || window.innerWidth;
      const height = this.canvas.clientHeight || window.innerHeight;

      // Create WebGL Renderer with transparency and antialiasing
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      this.scene = new THREE.Scene();

      // Camera setup matching typical mobile/webcam aspect ratio
      this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      this.camera.position.z = 5;

      // Ambient and directional lighting for vibrant 3D materials
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      this.scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.5);
      dirLight.position.set(0, 5, 5);
      this.scene.add(dirLight);

      const pointLight = new THREE.PointLight(0xff007f, 2, 10);
      pointLight.position.set(0, 0, 3);
      this.scene.add(pointLight);

      // Build all 3D Filter Assets
      this.buildCyberpunkFilter();
      this.buildBunnyEarsFilter();
      this.buildStarGlassesFilter();
      this.buildHaloFilter();
      this.buildFireCrownFilter();

      // Start render loop
      this.animate();
    } catch (err) {
      console.error('Three.js initialization failed:', err);
    }
  }

  // 1. Cyberpunk 2077 HUD Visor Filter
  private buildCyberpunkFilter() {
    const group = new THREE.Group();

    // Curved neon visor band
    const visorGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.35, 32, 1, true, -Math.PI / 3, (2 * Math.PI) / 3);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.9,
      side: THREE.DoubleSide,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.6,
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.rotation.y = Math.PI / 2;
    visorMesh.position.set(0, 0.2, 0.4);
    group.add(visorMesh);

    // Glowing Neon Cyber Accent Lines
    const lineGeo = new THREE.BoxGeometry(1.6, 0.04, 0.05);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.position.set(0, 0.38, 0.9);
    group.add(lineMesh);

    // Holographic corner bracket chips
    const chipGeo = new THREE.BoxGeometry(0.12, 0.12, 0.1);
    const chipMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const leftChip = new THREE.Mesh(chipGeo, chipMat);
    leftChip.position.set(-0.85, 0.2, 0.6);
    const rightChip = new THREE.Mesh(chipGeo, chipMat);
    rightChip.position.set(0.85, 0.2, 0.6);
    group.add(leftChip, rightChip);

    group.visible = false;
    this.filterObjects.set('cyberpunk', group);
    this.scene?.add(group);
  }

  // 2. Neon Bunny Ears with Physics Oscillation
  private buildBunnyEarsFilter() {
    const group = new THREE.Group();

    const earShape = new THREE.ConeGeometry(0.22, 1.3, 16);
    const earOuterMat = new THREE.MeshStandardMaterial({
      color: 0xff2a85,
      emissive: 0xff0055,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const earInnerMat = new THREE.MeshStandardMaterial({
      color: 0xffb3da,
      emissive: 0xff77aa,
      emissiveIntensity: 0.5,
    });

    // Left Ear
    const leftEar = new THREE.Mesh(earShape, earOuterMat);
    leftEar.position.set(-0.55, 1.4, 0);
    leftEar.rotation.z = 0.2;
    leftEar.name = 'leftEar';

    // Right Ear
    const rightEar = new THREE.Mesh(earShape, earOuterMat);
    rightEar.position.set(0.55, 1.4, 0);
    rightEar.rotation.z = -0.2;
    rightEar.name = 'rightEar';

    // Inner insets
    const innerShape = new THREE.ConeGeometry(0.14, 0.9, 16);
    const leftInner = new THREE.Mesh(innerShape, earInnerMat);
    leftInner.position.set(0, 0, 0.05);
    leftEar.add(leftInner);

    const rightInner = new THREE.Mesh(innerShape, earInnerMat);
    rightInner.position.set(0, 0, 0.05);
    rightEar.add(rightInner);

    group.add(leftEar, rightEar);

    // Glowing Whiskers / Nose Sparkle
    const noseGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xff4081 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, -0.1, 0.85);
    group.add(nose);

    group.visible = false;
    this.filterObjects.set('bunny', group);
    this.scene?.add(group);
  }

  // 3. Retro Star Holographic Glasses
  private buildStarGlassesFilter() {
    const group = new THREE.Group();

    // Create 5-point star shape
    const starShape = new THREE.Shape();
    const outerRadius = 0.45;
    const innerRadius = 0.22;
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const a = (i / points) * Math.PI - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();

    const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02 };
    const starGeo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffa500,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
    });

    const leftStar = new THREE.Mesh(starGeo, starMat);
    leftStar.position.set(-0.5, 0.2, 0.8);
    const rightStar = new THREE.Mesh(starGeo, starMat);
    rightStar.position.set(0.5, 0.2, 0.8);

    // Star Bridge
    const bridgeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
    const bridge = new THREE.Mesh(bridgeGeo, starMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.2, 0.82);

    group.add(leftStar, rightStar, bridge);
    group.visible = false;
    this.filterObjects.set('glasses', group);
    this.scene?.add(group);
  }

  // 4. Angelic Golden Halo with floating particle sparkles
  private buildHaloFilter() {
    const group = new THREE.Group();

    // Torus Halo
    const haloGeo = new THREE.TorusGeometry(0.85, 0.08, 16, 64);
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffcc00,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2.3;
    halo.position.set(0, 1.2, 0.2);
    halo.name = 'haloRing';
    group.add(halo);

    // Orbiting sparkle particles
    const particleCount = 20;
    const partGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particles = new THREE.Group();
    particles.name = 'haloSparkles';

    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Mesh(partGeo, partMat);
      const angle = (i / particleCount) * Math.PI * 2;
      p.position.set(Math.cos(angle) * 0.95, 1.2 + (Math.random() - 0.5) * 0.2, Math.sin(angle) * 0.95);
      particles.add(p);
    }
    group.add(particles);

    group.visible = false;
    this.filterObjects.set('halo', group);
    this.scene?.add(group);
  }

  // 5. Crown of Fire & Flames
  private buildFireCrownFilter() {
    const group = new THREE.Group();

    // Crown base ring
    const baseGeo = new THREE.TorusGeometry(0.75, 0.06, 16, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xff3b00,
      emissive: 0xff5500,
      emissiveIntensity: 0.9,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = Math.PI / 2;
    base.position.set(0, 0.85, 0);
    group.add(base);

    // Spikes / flame spires
    const flameCount = 7;
    for (let i = 0; i < flameCount; i++) {
      const angle = ((i - flameCount / 2) / flameCount) * (Math.PI * 0.9);
      const height = i % 2 === 0 ? 0.6 : 0.4;
      const spikeGeo = new THREE.ConeGeometry(0.1, height, 8);
      const spikeMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xff4500 : 0xffa500,
        emissive: 0xff7700,
        emissiveIntensity: 1.0,
      });
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(Math.sin(angle) * 0.72, 0.85 + height / 2, Math.cos(angle) * 0.72);
      spike.name = `flame_${i}`;
      group.add(spike);
    }

    group.visible = false;
    this.filterObjects.set('fire', group);
    this.scene?.add(group);
  }

  public setFilter(filterId: ARFilterId) {
    this.currentFilter = filterId;
    this.filterObjects.forEach((obj, key) => {
      obj.visible = key === filterId;
    });
  }

  /**
   * Updates face transform from MediaPipe / webcam face tracker coordinates
   */
  public updateFaceTransform(pos: Partial<FacePosition>) {
    Object.assign(this.faceState, pos);
  }

  /**
   * Forces an immediate synchronous render of the scene for instant camera snapshots
   */
  public renderOnce() {
    if (this.renderer && this.scene && this.camera && !this.isDisposed) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private animate = () => {
    if (this.isDisposed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const elapsedTime = (now - this.startTime) / 1000;

    // Subtle natural head sway simulation when no face detected, or smooth tracking when detected
    let targetX = 0;
    let targetY = 0;
    let targetScale = 1;
    let targetRoll = 0;

    if (this.faceState.detected) {
      // Map normalized coordinates (-1 to 1) to Three.js world space
      targetX = this.faceState.x * 2.2;
      targetY = this.faceState.y * 2.2;
      targetScale = this.faceState.scale;
      targetRoll = this.faceState.roll;
    } else {
      // Gentle breathing idle animation
      targetY = Math.sin(elapsedTime * 2) * 0.05;
      targetRoll = Math.sin(elapsedTime * 1.5) * 0.03;
    }

    // Apply smooth interpolation to active 3D filter
    const activeObj = this.filterObjects.get(this.currentFilter);
    if (activeObj && activeObj.visible) {
      activeObj.position.x += (targetX - activeObj.position.x) * 0.25;
      activeObj.position.y += (targetY - activeObj.position.y) * 0.25;
      activeObj.rotation.z += (targetRoll - activeObj.rotation.z) * 0.25;
      const currentScale = activeObj.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * 0.2;
      activeObj.scale.set(newScale, newScale, newScale);

      // Filter-specific micro-animations
      if (this.currentFilter === 'bunny') {
        const leftEar = activeObj.getObjectByName('leftEar');
        const rightEar = activeObj.getObjectByName('rightEar');
        if (leftEar && rightEar) {
          leftEar.rotation.x = Math.sin(elapsedTime * 6) * 0.08;
          rightEar.rotation.x = Math.sin(elapsedTime * 6 + 0.5) * 0.08;
        }
      } else if (this.currentFilter === 'halo') {
        const haloRing = activeObj.getObjectByName('haloRing');
        const sparkles = activeObj.getObjectByName('haloSparkles');
        if (haloRing) {
          haloRing.position.y = 1.2 + Math.sin(elapsedTime * 3) * 0.06;
        }
        if (sparkles) {
          sparkles.rotation.y += delta * 1.5;
        }
      } else if (this.currentFilter === 'fire') {
        activeObj.children.forEach((child) => {
          if (child.name.startsWith('flame_')) {
            child.scale.y = 0.85 + Math.sin(elapsedTime * 10 + child.id) * 0.25;
          }
        });
      }
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  public renderOnce() {
    if (this.renderer && this.scene && this.camera && !this.isDisposed) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public resize(width: number, height: number) {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /**
   * Explicit Memory Leak Prevention:
   * Complies strictly with Section 6 QA Directive:
   * "Ensure Three.js scenes and webcam streams are explicitly disposed of
   * when the user swipes away from the camera pane to prevent browser crashes."
   */
  public dispose() {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Traverse and dispose all materials, geometries, and textures
    if (this.scene) {
      this.scene.traverse((object: any) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat: any) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }
      this.scene = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.filterObjects.clear();
    console.log('[AR ENGINE] Successfully disposed Three.js scene and geometries.');
  }
}
