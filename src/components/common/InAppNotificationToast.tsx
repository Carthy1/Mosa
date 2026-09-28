'use client';

import React, { useEffect, useState } from 'react';
import { Camera, Video, MessageSquare, X, ChevronRight } from 'lucide-react';

export interface InAppNotificationData {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  createdAt: number;
}

interface InAppNotificationToastProps {
  notification: InAppNotificationData | null;
  onOpenChat: (chatId: string, senderId: string) => void;
  onDismiss: () => void;
}

export function InAppNotificationToast({
  notification,
  onOpenChat,
  onDismiss,
}: InAppNotificationToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) return;

    setProgress(100);
    const durationMs = 4500;
    const intervalTime = 50;
    const decrement = (intervalTime / durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= decrement) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - decrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const isSnap = notification.type === 'image' || notification.type === 'video';

  const previewText =
    notification.type === 'image'
      ? '📸 Sent a photo snap'
      : notification.type === 'video'
      ? '🎥 Sent a video snap'
      : notification.content || 'New message';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none flex justify-center px-4 animate-in slide-in-from-top-4 duration-300 select-none"
      style={{
        paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 24px) + 0.5rem))',
      }}
    >
      <div
        onClick={() => onOpenChat(notification.chatId, notification.senderId)}
        className="pointer-events-auto bg-[#161622]/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 max-w-sm w-full cursor-pointer hover:border-yellow-400/50 transition-all active:scale-[0.98] group overflow-hidden relative"
      >
        {/* Left: Sender Photo or Icon */}
        <div className="relative flex-shrink-0">
          {notification.senderPhoto ? (
            <img
              src={notification.senderPhoto}
              alt={notification.senderName}
              className="w-10 h-10 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm border border-white/20">
              {notification.senderName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Type Badge Icon */}
          <div
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border border-black ${
              notification.type === 'image'
                ? 'bg-red-500 text-white'
                : notification.type === 'video'
                ? 'bg-purple-500 text-white'
                : 'bg-yellow-400 text-black'
            }`}
          >
            {notification.type === 'image' ? (
              <Camera className="w-2.5 h-2.5" />
            ) : notification.type === 'video' ? (
              <Video className="w-2.5 h-2.5" />
            ) : (
              <MessageSquare className="w-2.5 h-2.5" />
            )}
          </div>
        </div>

        {/* Center: Sender Name and Message Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-bold text-white truncate">
              {notification.senderName}
            </p>
            <span className="text-[10px] text-white/40 font-medium flex-shrink-0">
              Just now
            </span>
          </div>
          <p
            className={`text-xs truncate mt-0.5 ${
              isSnap
                ? 'text-yellow-300 font-semibold'
                : 'text-white/80'
            }`}
          >
            {previewText}
          </p>
        </div>

        {/* Right: Reply / Open Pill and Close Button */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="px-2.5 py-1 rounded-full bg-white/10 group-hover:bg-yellow-400 group-hover:text-black text-white text-[11px] font-bold transition-colors flex items-center gap-0.5">
            <span>Reply</span>
            <ChevronRight className="w-3 h-3" />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 active:scale-90 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom subtle time-remaining progress line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-purple-500 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
