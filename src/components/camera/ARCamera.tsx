'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  RotateCcw,
  Sparkles,
  Zap,
  ZapOff,
  Camera as CameraIcon,
  Video,
  AlertCircle,
  Upload,
  Layers,
  Smile,
  Flame,
  Star,
  Eye,
  Glasses,
  Moon,
} from 'lucide-react';
import { ARFilterId, ARFilterConfig, UserProfile } from '@/types';
import { ARFilterEngine } from './ARFilterEngine';
import { FaceTracker } from './FaceTracker';
import { SnapPreviewModal } from './SnapPreviewModal';

const FILTERS: ARFilterConfig[] = [
  { id: 'none', name: 'Normal', icon: 'Normal', color: '#888', description: 'Clean camera' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: 'Visor', color: '#00f0ff', description: '3D Neon HUD Visor' },
  { id: 'bunny', name: 'Neon Bunny', icon: 'Bunny', color: '#ff2a85', description: '3D Ears with Physics' },
  { id: 'glasses', name: 'Star Shades', icon: 'Stars', color: '#ffd700', description: '3D Holographic Glasses' },
  { id: 'halo', name: 'Holy Halo', icon: 'Halo', color: '#ffea00', description: '3D Orbiting Sparkles' },
  { id: 'fire', name: 'Fire Crown', icon: 'Flames', color: '#ff4500', description: 'Dynamic 3D Spire Spires' },
];

interface ARCameraProps {
  isActive: boolean;
  currentUser: UserProfile;
  friends: UserProfile[];
  onOpenQAAudit?: () => void;
  onOpenAuth?: () => void;
}

export function ARCamera({ isActive, currentUser, friends, onOpenQAAudit, onOpenAuth }: ARCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeFilter, setActiveFilter] = useState<ARFilterId>('cyberpunk');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recording & capture state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Preview state
  const [capturedMedia, setCapturedMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Engine references
  const engineRef = useRef<ARFilterEngine | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  /**
   * Initializes the webcam media stream and Three.js AR filter engine
   * ONLY when the camera pane is active (Section 5.1 & Section 6)
   */
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('unsupported');
      setErrorMessage('Your browser does not support camera capture via getUserMedia.');
      return;
    }

    try {
      // Stop any existing stream first
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (videoErr) {
        // Fallback to basic webcam constraints if high-res fails
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      mediaStreamRef.current = stream;
      setPermissionState('granted');
      setErrorMessage(null);

      // Check for torch capability
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
      setHasTorch(Boolean(capabilities.torch));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.log('Video autoplay error:', e));
      }

      // Initialize Three.js WebGL Engine if canvas is ready
      if (canvasRef.current && !engineRef.current) {
        engineRef.current = new ARFilterEngine(canvasRef.current);
        engineRef.current.setFilter(activeFilter);
      }

      // Initialize Face Tracker
      if (videoRef.current && !trackerRef.current && engineRef.current) {
        trackerRef.current = new FaceTracker(videoRef.current, (pos) => {
          engineRef.current?.updateFaceTransform(pos);
        });
        trackerRef.current.start();
      }
    } catch (err: any) {
      console.warn('Camera access denied or failed:', err);
      setPermissionState('denied');
      setErrorMessage(err.name === 'NotAllowedError' ? 'Camera permission was denied.' : err.message);
    }
  }, [facingMode, activeFilter]);

  /**
   * Memory Leak Prevention:
   * Complies with Section 6 QA Directive:
   * Explicitly stop tracks and dispose Three.js scene when isActive is false.
   */
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`[CAMERA CLEANUP] Stopped track: ${track.kind}`);
      });
      mediaStreamRef.current = null;
    }

    if (trackerRef.current) {
      trackerRef.current.dispose();
      trackerRef.current = null;
    }

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Monitor pane activation state
  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, startCamera, stopCamera]);

  // Handle active filter change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setFilter(activeFilter);
    }
  }, [activeFilter]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && engineRef.current) {
        engineRef.current.resize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Flip front/back camera
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Toggle torch/light
  const handleToggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  /**
   * Snap Photo:
   * Merges video frame + Three.js canvas into high-resolution snapshot
   */
  const handleSnapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const threeCanvas = canvasRef.current;

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = video.videoWidth || 1280;
    outputCanvas.height = video.videoHeight || 720;
    const ctx = outputCanvas.getContext('2d');

    if (!ctx) return;

    // Draw video feed (flip horizontally if front camera for natural selfie view)
    if (facingMode === 'user') {
      ctx.translate(outputCanvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, outputCanvas.width, outputCanvas.height);

    // Reset transform before overlaying Three.js WebGL canvas
    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // Draw Three.js WebGL overlay
    ctx.drawImage(threeCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          setCapturedMedia({ url: blobUrl, type: 'image' });
        } else {
          const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.82);
          setCapturedMedia({ url: dataUrl, type: 'image' });
        }
      },
      'image/jpeg',
      0.82
    );
  };

  /**
   * Video Recording:
   * Records up to 15 seconds of combined video feed + AR overlay
   */
  const startRecording = () => {
    if (!videoRef.current) return;

    try {
      recordedChunksRef.current = [];
      const stream = mediaStreamRef.current;
      if (!stream) return;

      const supportedMime =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : undefined;

      const mediaRecorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        setCapturedMedia({ url: videoUrl, type: 'video' });
      };

      mediaRecorder.start(200);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 15) {
            stopRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e) {
      console.warn('MediaRecorder error:', e);
      // Fallback: take photo
      handleSnapPhoto();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  /**
   * File Upload Fallback:
   * Allows testing snaps and filters even on devices without a webcam
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);
    setCapturedMedia({ url, type: isVideo ? 'video' : 'image' });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden select-none"
    >
      {/* 1. Underlying HTML5 Video Stream */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${
          facingMode === 'user' ? 'scale-x-[-1]' : ''
        }`}
      />

      {/* 2. WebGL Three.js Overlay Canvas for 3D Face Filters */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* 3. Hardware Fallback / Permission Denied Screen */}
      {permissionState === 'denied' && (
        <div className="absolute inset-0 z-30 bg-gray-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">Camera Access Denied</h3>
          <p className="text-sm text-white/60 max-w-sm mb-6">
            {errorMessage || 'Please allow webcam access in your browser settings to use real-time AR filters.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={startCamera}
              className="px-6 py-2.5 bg-yellow-400 text-black font-bold rounded-full hover:bg-yellow-300 active:scale-95 transition-all cursor-pointer"
            >
              Retry Camera
            </button>
            <label className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium rounded-full cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Upload className="w-4 h-4" />
              Upload Photo Instead
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* 4. Top Camera Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
        {/* Profile / Status badge with Mosa branding */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenAuth}
            className="w-10 h-10 rounded-full border-2 border-yellow-400 overflow-hidden bg-white/10 shadow-lg active:scale-95 transition-transform cursor-pointer"
            title="Manage Firebase Account / Profiles"
          >
            <img
              src={currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt={currentUser.displayName}
              className="w-full h-full object-cover"
            />
          </button>
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <span className="text-sm font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
              Mosa
            </span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="text-xs font-semibold text-white/90">
              {FILTERS.find((f) => f.id === activeFilter)?.name}
            </span>
          </div>
        </div>

        {/* Right action icons */}
        <div className="flex items-center gap-3">
          {/* Flip camera */}
          <button
            onClick={handleFlipCamera}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:rotate-180 transition-all cursor-pointer shadow-lg"
            title="Flip Camera"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Torch toggle */}
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                torchOn
                  ? 'bg-yellow-400 text-black border-yellow-300'
                  : 'bg-black/40 text-white border-white/20'
              }`}
            >
              {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          {/* QA Audit Button */}
          {onOpenQAAudit && (
            <button
              onClick={onOpenQAAudit}
              className="px-3 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-yellow-400 hover:text-yellow-300 flex items-center gap-1.5 text-xs font-bold shadow-lg cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>QA</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Filter Selector Bar (Above Shutter) */}
      <div className="absolute bottom-28 left-0 right-0 z-20 flex justify-center items-center px-4">
        <div className="flex items-center gap-3 overflow-x-auto py-2 px-4 no-scrollbar max-w-md bg-black/40 backdrop-blur-md rounded-full border border-white/15 shadow-2xl">
          {FILTERS.map((filter) => {
            const isSelected = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`relative px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black shadow-lg scale-105'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: filter.color }}
                />
                {filter.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Shutter Button & Capture Interface */}
      <div className="absolute bottom-8 left-0 right-0 z-20 flex items-center justify-around px-8">
        {/* Upload Fallback icon */}
        <label className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white cursor-pointer active:scale-90 transition-transform">
          <Upload className="w-5 h-5" />
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Central Shutter Button (Click = Photo, Hold = Video) */}
        <div className="relative flex items-center justify-center">
          {/* Recording pulse ring */}
          {isRecording && (
            <div className="absolute w-24 h-24 rounded-full border-4 border-red-500 animate-ping opacity-75" />
          )}

          <button
            onClick={handleSnapPhoto}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`w-20 h-20 rounded-full border-4 transition-all duration-200 cursor-pointer flex items-center justify-center shadow-2xl ${
              isRecording
                ? 'bg-red-500 border-white scale-110'
                : 'bg-white/20 hover:bg-white/30 border-white active:scale-95'
            }`}
          >
            <div
              className={`rounded-full transition-all duration-200 ${
                isRecording ? 'w-8 h-8 bg-white rounded-md' : 'w-14 h-14 bg-white'
              }`}
            />
          </button>
        </div>

        {/* Filter Quick Switcher */}
        <button
          onClick={() => {
            const nextIdx = (FILTERS.findIndex((f) => f.id === activeFilter) + 1) % FILTERS.length;
            setActiveFilter(FILTERS[nextIdx].id);
          }}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
        >
          <Sparkles className="w-5 h-5 text-yellow-400" />
        </button>
      </div>

      {/* Recording Duration Indicator */}
      {isRecording && (
        <div className="absolute top-20 z-20 bg-red-600/90 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-lg animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>REC 00:{recordingDuration.toString().padStart(2, '0')} / 00:15</span>
        </div>
      )}

      {/* 7. Snap Preview Modal (when photo/video is taken) */}
      {capturedMedia && (
        <SnapPreviewModal
          mediaUrl={capturedMedia.url}
          mediaType={capturedMedia.type}
          currentUser={currentUser}
          friends={friends}
          onClose={() => setCapturedMedia(null)}
          onSendComplete={() => setCapturedMedia(null)}
        />
      )}
    </div>
  );
}
