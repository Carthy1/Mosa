'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Story, UserProfile } from '@/types';
import { deleteStory } from '@/lib/firebase/firestore';
import { X, Trash2, Clock, Eye, Sparkles } from 'lucide-react';

interface StoryViewerModalProps {
  stories: Story[];
  initialIndex?: number;
  currentUser: UserProfile;
  onClose: () => void;
}

export function StoryViewerModal({
  stories,
  initialIndex = 0,
  currentUser,
  onClose,
}: StoryViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (!currentStory) {
      onClose();
      return;
    }

    setProgress(0);
    const storyDuration = 5000; // 5 seconds per slide
    const intervalMs = 50;
    const step = (intervalMs / storyDuration) * 100;

    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev >= 100) {
            handleNext();
            return 0;
          }
          return prev + step;
        });
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused, stories.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory) return;
    if (confirm('Delete this story?')) {
      await deleteStory(currentStory.id);
      handleNext();
    }
  };

  if (!currentStory) return null;

  // Calculate remaining TTL time
  const remainingMs = Math.max(0, currentStory.expiresAt - Date.now());
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Top Segmented Progress Bars */}
      <div
        className="relative z-30 w-full p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        style={{ paddingTop: 'max(1.25rem, calc(env(safe-area-inset-top, 24px) + 0.5rem))' }}
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          {stories.map((story, idx) => (
            <div
              key={story.id}
              className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-75"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Story Author & Header Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={
                currentStory.authorAvatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
              }
              alt={currentStory.authorName}
              className="w-10 h-10 rounded-full object-cover border border-white/30"
            />
            <div>
              <p className="font-bold text-sm text-white">{currentStory.authorName}</p>
              <div className="flex items-center gap-1.5 text-xs text-white/70">
                <Clock className="w-3 h-3 text-yellow-400" />
                <span>
                  Expires in {remainingHours}h {remainingMinutes}m (Firestore TTL)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentStory.authorId === currentUser.uid && (
              <button
                onClick={handleDelete}
                className="w-9 h-9 rounded-full bg-red-500/30 hover:bg-red-500/50 border border-red-500/40 flex items-center justify-center text-red-200 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/25 flex items-center gap-1.5 text-white active:scale-95 transition-transform cursor-pointer font-bold text-xs shadow-lg"
              title="Close story"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Story Media */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {currentStory.type === 'video' ? (
          <video
            src={currentStory.mediaUrl}
            autoPlay
            playsInline
            loop
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={currentStory.mediaUrl}
            alt="Story Media"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Floating Caption */}
      {currentStory.caption && (
        <div className="relative z-30 mb-8 px-6 flex justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full text-white text-center font-medium shadow-2xl max-w-[90%] text-sm sm:text-base">
            {currentStory.caption}
          </div>
        </div>
      )}

      {/* Invisible Touch Tap Navigation Zones */}
      <div className="absolute inset-0 z-20 flex">
        <div className="w-1/3 h-full cursor-pointer" onClick={handlePrev} />
        <div className="w-2/3 h-full cursor-pointer" onClick={handleNext} />
      </div>
    </div>
  );
}
