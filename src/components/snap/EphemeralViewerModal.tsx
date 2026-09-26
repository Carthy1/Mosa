'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Message } from '@/types';
import { markSnapViewed } from '@/lib/firebase/firestore';
import { X, Flame, ShieldAlert } from 'lucide-react';

interface EphemeralViewerModalProps {
  message: Message;
  chatId: string;
  senderName: string;
  onClose: () => void;
}

export function EphemeralViewerModal({
  message,
  chatId,
  senderName,
  onClose,
}: EphemeralViewerModalProps) {
  const initialDuration = message.duration || 10;
  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const [isClosing, setIsClosing] = useState(false);
  const hasTriggeredPurge = useRef(false);

  useEffect(() => {
    // If infinite duration
    if (initialDuration > 3600) return;

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
  }, [initialDuration]);

  const handleExpire = async () => {
    if (hasTriggeredPurge.current) return;
    hasTriggeredPurge.current = true;
    setIsClosing(true);

    // Ephemeral Guarantee: Update viewStatus and trigger storage deletion
    await markSnapViewed(chatId, message.id, message.content);

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
      <div className="relative z-30 w-full p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
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
              <div className="flex items-center gap-1 text-[11px] text-yellow-400 font-medium">
                <Flame className="w-3 h-3 fill-yellow-400" />
                <span>Ephemeral Snap • Disappears when timer ends</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Circular Timer Ring */}
            <div className="relative w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full border border-white/20">
              <span className="text-xs font-black text-white">{timeLeft}s</span>
            </div>

            <button
              onClick={handleExpire}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Snap Media Content */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {message.type === 'video' ? (
          <video
            src={message.content}
            autoPlay
            playsInline
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

      {/* Bottom Ephemeral Security Banner */}
      <div className="relative z-30 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-xs text-white/60">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />
          <span>Screenshot detection & Storage Auto-Purge active</span>
        </div>
        <button
          onClick={handleExpire}
          className="text-white font-medium hover:underline cursor-pointer"
        >
          Close & Purge
        </button>
      </div>
    </div>
  );
}
