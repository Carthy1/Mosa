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
  MessageSquare,
  PlaySquare,
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
  defaultRecipient?: UserProfile | null;
  unopenedSnapsCount?: number;
  unseenStoriesCount?: number;
  onNavigateToChat?: () => void;
  onNavigateToStories?: () => void;
  onOpenQAAudit?: () => void;
  onOpenAuth?: () => void;
}

export function ARCamera({
  isActive,
  currentUser,
  friends,
  defaultRecipient,
  unopenedSnapsCount = 0,
  unseenStoriesCount = 0,
  onNavigateToChat,
  onNavigateToStories,
  onOpenQAAudit,
  onOpenAuth,
}: ARCameraProps) {
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
  const [sendToast, setSendToast] = useState<{ message: string; actionText?: string; onAction?: () => void } | null>(null);

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

  // Video playback resume watchdog: ensures video resumes if paused by preview or audio focus
  useEffect(() => {
    if (!capturedMedia && isActive && videoRef.current && mediaStreamRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [capturedMedia, isActive]);

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

  // Shutter gesture discrimination: Quick tap (<350ms) = High-Res Photo, Long press (>350ms) = Video Recording
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingToRecordRef = useRef<boolean>(false);
  const pressStartTimeRef = useRef<number>(0);

  /**
   * Snap Photo:
   * Merges video frame + Three.js canvas into high-resolution snapshot with synchronous Data URL fallback
   */
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const width = video.videoWidth > 0 ? video.videoWidth : (video.clientWidth || 1280);
      const height = video.videoHeight > 0 ? video.videoHeight : (video.clientHeight || 720);

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const ctx = outputCanvas.getContext('2d');

      if (!ctx) return;

      // Draw camera video feed if video is playing and ready
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (facingMode === 'user') {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, width, height);

        // Reset transform before overlaying Three.js WebGL canvas
        if (facingMode === 'user') {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      } else {
        // Fallback: draw stylish AR gradient backdrop if camera is initializing or in demo mode
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#1a0b2e');
        grad.addColorStop(0.5, '#2e124d');
        grad.addColorStop(1, '#0a0a14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // If WebGL Three.js canvas exists, force synchronous render of current frame and overlay
      if (canvasRef.current && engineRef.current) {
        try {
          if (typeof engineRef.current.renderOnce === 'function') {
            engineRef.current.renderOnce();
          }
          ctx.drawImage(canvasRef.current, 0, 0, width, height);
        } catch (overlayErr) {
          console.warn('WebGL overlay draw warning:', overlayErr);
        }
      }

      // Generate instant high-quality JPEG Data URL (synchronous, reliable on all iOS Safari & Chrome versions)
      const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.92);
      if (dataUrl && dataUrl.length > 200) {
        setCapturedMedia({ url: dataUrl, type: 'image' });
      } else {
        // Fallback to blob URL if dataURL is unexpectedly empty
        outputCanvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              const blobUrl = URL.createObjectURL(blob);
              setCapturedMedia({ url: blobUrl, type: 'image' });
            }
          },
          'image/jpeg',
          0.92
        );
      }
    } catch (err) {
      console.error('Failed to capture photo:', err);
    }
  };

  /**
   * Video Recording:
   * Records up to 15 seconds of camera feed with cross-browser MIME negotiation
   */
  const startRecording = () => {
    if (!videoRef.current) return;

    try {
      recordedChunksRef.current = [];
      const stream = mediaStreamRef.current;
      if (!stream) return;

      const getSupportedMimeType = () => {
        if (typeof MediaRecorder === 'undefined') return undefined;
        const types = [
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) return t;
        }
        return undefined;
      };

      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) {
          // If no chunks were produced (e.g. premature stop), fall back to photo snap
          handleSnapPhoto();
          return;
        }

        const actualMime = mediaRecorder.mimeType || mimeType || 'video/mp4';
        const blob = new Blob(recordedChunksRef.current, { type: actualMime });

        if (blob.size < 500) {
          // Empty or broken recording: snap photo instead of showing blank video
          handleSnapPhoto();
          return;
        }

        const videoUrl = URL.createObjectURL(blob);
        setCapturedMedia({ url: videoUrl, type: 'video' });
      };

      mediaRecorder.start(100);
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
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleShutterPointerDown = (e: React.SyntheticEvent) => {
    e.preventDefault();
    pressStartTimeRef.current = Date.now();
    isHoldingToRecordRef.current = false;

    // Wait 350ms: if user keeps pressing, start video recording!
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      isHoldingToRecordRef.current = true;
      startRecording();
    }, 350);
  };

  const handleShutterPointerUp = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    const elapsed = Date.now() - pressStartTimeRef.current;

    if (isHoldingToRecordRef.current) {
      // User held and recorded a video
      isHoldingToRecordRef.current = false;
      stopRecording();
    } else if (elapsed < 350) {
      // User quickly tapped (< 350ms) -> SNAP A HIGH-RES PHOTO
      handleSnapPhoto();
    }
  };

  const handleShutterPointerCancel = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (isHoldingToRecordRef.current) {
      isHoldingToRecordRef.current = false;
      stopRecording();
    }
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
    e.target.value = '';
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
      <div
        className="absolute left-4 right-4 z-20 flex items-center justify-between pointer-events-auto"
        style={{ top: 'max(1.25rem, calc(env(safe-area-inset-top, 24px) + 0.5rem))' }}
      >
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

      {/* 5. Filter Selector Bar (Above Shutter, isolated from horizontal pane drag) */}
      <div 
        className="absolute bottom-28 left-0 right-0 z-20 flex justify-center items-center px-4 pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 overflow-x-auto py-2 px-3.5 no-scrollbar max-w-md bg-black/50 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl">
          {FILTERS.map((filter) => {
            const isSelected = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFilter(filter.id);
                }}
                className={`relative px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-white text-black shadow-lg scale-105 font-bold'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: filter.color }}
                />
                {filter.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Snapchat-style Camera Bottom Control Bar (Completely unblocked) */}
      <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 z-20 flex items-center justify-between px-6 pointer-events-auto max-w-md mx-auto">
        {/* Left Side: Jump to Chat + Upload */}
        <div className="flex items-center gap-3">
          {/* Chat shortcut button */}
          <button
            type="button"
            onClick={onNavigateToChat}
            className="relative w-12 h-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center text-white/90 hover:text-white active:scale-90 transition-transform cursor-pointer shadow-xl"
            title="Open Chat"
            aria-label="Open Chat"
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              {unopenedSnapsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border border-black" />
              )}
            </div>
            <span className="text-[9px] font-bold text-purple-300">Chat</span>
          </button>

          {/* Upload photo/video button */}
          <label 
            className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white/80 hover:text-white cursor-pointer active:scale-90 transition-transform shadow-lg"
            title="Upload Photo or Video"
          >
            <Upload className="w-4 h-4" />
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Center: Hero Shutter Button (Click = Photo, Hold = Video) */}
        <div className="relative flex items-center justify-center">
          {/* Recording pulse ring */}
          {isRecording && (
            <div className="absolute w-24 h-24 rounded-full border-4 border-red-500 animate-ping opacity-75" />
          )}

          <button
            onPointerDown={handleShutterPointerDown}
            onPointerUp={handleShutterPointerUp}
            onPointerCancel={handleShutterPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-20 h-20 rounded-full border-4 transition-all duration-200 cursor-pointer flex items-center justify-center shadow-2xl touch-none select-none ${
              isRecording
                ? 'bg-red-500 border-white scale-110'
                : 'bg-white/20 hover:bg-white/30 border-white active:scale-95'
            }`}
            title="Tap for photo, hold for video"
            aria-label="Take photo or hold for video"
          >
            <div
              className={`rounded-full transition-all duration-200 pointer-events-none ${
                isRecording ? 'w-8 h-8 bg-white rounded-md' : 'w-14 h-14 bg-white'
              }`}
            />
          </button>
        </div>

        {/* Right Side: Quick Filter Switcher + Jump to Stories */}
        <div className="flex items-center gap-3">
          {/* Quick cycle filters button */}
          <button
            type="button"
            onClick={() => {
              const nextIdx = (FILTERS.findIndex((f) => f.id === activeFilter) + 1) % FILTERS.length;
              setActiveFilter(FILTERS[nextIdx].id);
            }}
            className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 flex items-center justify-center text-yellow-400 hover:text-yellow-300 active:scale-90 transition-transform cursor-pointer shadow-lg"
            title="Next Filter"
            aria-label="Next Filter"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Stories shortcut button */}
          <button
            type="button"
            onClick={onNavigateToStories}
            className="relative w-12 h-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center text-white/90 hover:text-white active:scale-90 transition-transform cursor-pointer shadow-xl"
            title="Open Stories"
            aria-label="Open Stories"
          >
            <div className="relative">
              <PlaySquare className="w-5 h-5 text-yellow-400" />
              {unseenStoriesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-yellow-400 border border-black" />
              )}
            </div>
            <span className="text-[9px] font-bold text-yellow-300">Stories</span>
          </button>
        </div>
      </div>

      {/* Recording Duration Indicator */}
      {isRecording && (
        <div className="absolute top-20 z-20 bg-red-600/90 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-lg animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>REC 00:{recordingDuration.toString().padStart(2, '0')} / 00:15</span>
        </div>
      )}

      {/* Floating Send Feedback Toast */}
      {sendToast && (
        <div className="absolute top-20 z-30 bg-black/85 backdrop-blur-xl border border-yellow-400/40 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 animate-in zoom-in-95 duration-200">
          <span className="text-xs font-bold">{sendToast.message}</span>
          {sendToast.actionText && (
            <button
              onClick={() => {
                sendToast.onAction?.();
                setSendToast(null);
              }}
              className="text-xs text-yellow-400 hover:underline font-extrabold cursor-pointer"
            >
              {sendToast.actionText} →
            </button>
          )}
        </div>
      )}

      {/* 7. Snap Preview Modal (when photo/video is taken) */}
      {capturedMedia && (
        <SnapPreviewModal
          mediaUrl={capturedMedia.url}
          mediaType={capturedMedia.type}
          currentUser={currentUser}
          friends={friends}
          defaultRecipient={defaultRecipient}
          onClose={() => {
            setCapturedMedia(null);
            if (videoRef.current && mediaStreamRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          onSendComplete={(info) => {
            setCapturedMedia(null);
            if (videoRef.current && mediaStreamRef.current) {
              videoRef.current.play().catch(() => {});
            }
            if (info?.target === 'chat') {
              const targetFriend = friends.find((f) => f.uid === info.friendUid) || defaultRecipient;
              const name = targetFriend?.displayName || 'Friend';
              setSendToast({
                message: `🔥 Snap delivered to ${name}!`,
                actionText: 'View in Chat',
                onAction: onNavigateToChat,
              });
              setTimeout(() => setSendToast(null), 4500);
            } else if (info?.target === 'story') {
              setSendToast({
                message: '✨ Posted to My Story!',
                actionText: 'View Stories',
                onAction: onNavigateToStories,
              });
              setTimeout(() => setSendToast(null), 4500);
            }
          }}
        />
      )}
    </div>
  );
}
