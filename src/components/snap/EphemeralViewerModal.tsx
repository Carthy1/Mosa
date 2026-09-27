'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Message, UserProfile } from '@/types';
import { markSnapViewed, saveSnap } from '@/lib/firebase/firestore';
import { X, Flame, ShieldAlert, Download, Bookmark, Check } from 'lucide-react';

interface EphemeralViewerModalProps {
  message: Message;
  chatId: string;
  senderName: string;
  currentUser?: UserProfile;
  onClose: () => void;
}

export function EphemeralViewerModal({
  message,
  chatId,
  senderName,
  currentUser,
  onClose,
}: EphemeralViewerModalProps) {
  const initialDuration = message.duration || 10;
  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const [isClosing, setIsClosing] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(message.isSaved));
  const [justSavedNotification, setJustSavedNotification] = useState(false);
  const hasTriggeredPurge = useRef(false);

  useEffect(() => {
    // If infinite duration or already saved, don't rush auto-purge
    if (initialDuration > 3600 || isSaved) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [initialDuration, isSaved]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExpire();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSaveSnap = async () => {
    setIsSaved(true);
    setJustSavedNotification(true);
    setTimeout(() => setJustSavedNotification(false), 2500);

    // 1. Download directly to device (using blob fetch to support cross-origin media)
    try {
      fetch(message.content)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `mosa_snap_${Date.now()}.${message.type === 'video' ? 'webm' : 'jpg'}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        })
        .catch(() => {
          const a = document.createElement('a');
          a.href = message.content;
          a.download = `mosa_snap_${Date.now()}.${message.type === 'video' ? 'webm' : 'jpg'}`;
          a.click();
        });
    } catch (e) {
      console.warn('Failed to download snap:', e);
    }

    // 2. Persist in Firestore and mockStore so both sender and recipient see it saved
    if (currentUser) {
      await saveSnap(chatId, message.id, currentUser.uid, currentUser.displayName || currentUser.username);
    }
  };

  const handleExpire = async () => {
    if (hasTriggeredPurge.current) return;
    hasTriggeredPurge.current = true;
    setIsClosing(true);

    // Ephemeral Guarantee: Update viewStatus and trigger storage deletion unless saved
    // Only recipient viewing the snap marks it viewed (sender previewing their own sent snap does not)
    if (!currentUser || currentUser.uid !== message.senderId) {
      await markSnapViewed(chatId, message.id, message.content, isSaved);
    }

    setTimeout(() => {
      onClose();
    }, 400);
  };

  const progressPercent = initialDuration > 0 ? (timeLeft / initialDuration) * 100 : 100;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none transition-opacity duration-300 ${
        isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
    >
      {/* Top Countdown Bar & Sender Info */}
      <div
        className="relative z-30 w-full p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        style={{ paddingTop: 'max(1.25rem, calc(env(safe-area-inset-top, 24px) + 0.5rem))' }}
      >
        {/* Progress depletion line */}
        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-yellow-400 transition-all duration-1000 linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white text-sm shadow">
              {senderName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-sm text-white">{senderName}</p>
              {isSaved ? (
                <div className="flex items-center gap-1 text-[11px] text-amber-300 font-semibold">
                  <Bookmark className="w-3 h-3 fill-amber-300" />
                  <span>Saved to Chat & Device • Will not expire</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[11px] text-yellow-400 font-medium">
                  <Flame className="w-3 h-3 fill-yellow-400" />
                  <span>Ephemeral Snap • Disappears when timer ends</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Save Snap Action Button */}
            <button
              onClick={handleSaveSnap}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                isSaved
                  ? 'bg-amber-400 text-black border border-amber-300'
                  : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20'
              }`}
              title="Save this snap to device and chat history"
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Save Snap</span>
                </>
              )}
            </button>

            {/* Circular Timer / Status Ring */}
            <div className="relative px-2.5 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full border border-white/20">
              <span className="text-xs font-black text-white">{isSaved ? 'Saved' : `${timeLeft}s`}</span>
            </div>

            <button
              onClick={handleExpire}
              className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/25 flex items-center gap-1.5 text-white/90 hover:text-white active:scale-95 transition-transform cursor-pointer font-bold text-xs shadow-lg"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Save Confirmation Notification */}
      {justSavedNotification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-amber-400 text-black font-extrabold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-in zoom-in-95 fade-in duration-200">
          <Bookmark className="w-4 h-4 fill-black" />
          <span className="text-xs">Saved to your device & chat thread!</span>
        </div>
      )}

      {/* Snap Media Content */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {message.type === 'video' ? (
          <video
            src={message.content}
            autoPlay
            playsInline
            controls={isSaved}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={message.content}
            alt="Ephemeral Snap"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Bottom Ephemeral Security Banner & Save Option */}
      <div className="relative z-30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-between text-xs text-white/80">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-[11px] text-white/70">
            {isSaved
              ? 'Snap saved to your device and pinned in chat'
              : 'Auto-Purge active unless saved'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isSaved && (
            <button
              onClick={handleSaveSnap}
              className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-bold flex items-center gap-1.5 cursor-pointer text-xs active:scale-95 shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Snap</span>
            </button>
          )}
          <button
            onClick={handleExpire}
            className={`px-3 py-1.5 rounded-full font-bold cursor-pointer text-xs transition-colors ${
              isSaved
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'text-white/70 hover:text-white underline'
            }`}
          >
            {isSaved ? 'Done' : 'Close & Purge'}
          </button>
        </div>
      </div>
    </div>
  );
}
