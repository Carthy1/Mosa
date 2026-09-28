'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Clock,
  Type,
  Download,
  Check,
  Sparkles,
  Users,
  Compass,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { UserProfile, Story } from '@/types';
import { publishStory, sendMessage, getChatIdForFriend, getCanonicalChatId } from '@/lib/firebase/firestore';
import { uploadMediaDirect, dataUrlToBlob } from '@/lib/firebase/storage';

interface SnapPreviewModalProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  currentUser: UserProfile;
  friends: UserProfile[];
  defaultRecipient?: UserProfile | null;
  onClose: () => void;
  onSendComplete: (info?: { target: 'story' | 'chat'; friendUid?: string }) => void;
}

export function SnapPreviewModal({
  mediaUrl,
  mediaType,
  currentUser,
  friends,
  defaultRecipient,
  onClose,
  onSendComplete,
}: SnapPreviewModalProps) {
  const [caption, setCaption] = useState('');
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [duration, setDuration] = useState<number>(10);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [showSendDrawer, setShowSendDrawer] = useState(Boolean(defaultRecipient));
  const [sendToStory, setSendToStory] = useState(!defaultRecipient);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    defaultRecipient ? [defaultRecipient.uid] : []
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const timerOptions = [3, 5, 10, 15, 0]; // 0 means infinity

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUploading) {
        if (showSendDrawer) {
          setShowSendDrawer(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUploading, showSendDrawer, onClose]);

  const toggleFriend = (uid: string) => {
    setSelectedFriends((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSend = async () => {
    if (!sendToStory && selectedFriends.length === 0) {
      alert('Please select either "My Story" or at least one friend.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Direct-to-storage upload simulation / live upload
      let finalMediaUrl = mediaUrl;

      // If it's a blob/base64, convert safely or push to storage
      if (mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:')) {
        try {
          let blob: Blob;
          if (mediaUrl.startsWith('data:')) {
            blob = dataUrlToBlob(mediaUrl);
          } else {
            const response = await fetch(mediaUrl);
            blob = await response.blob();
          }
          finalMediaUrl = await uploadMediaDirect(
            blob,
            `snaps/${currentUser.uid}/${Date.now()}.${mediaType === 'video' ? 'webm' : 'jpg'}`,
            (progress) => setUploadProgress(progress)
          );
        } catch (fetchErr) {
          console.warn('Process media error in SnapPreviewModal:', fetchErr);
        }
      }

      // 1. Send to Story if selected (24h TTL)
      if (sendToStory) {
        await publishStory(currentUser, finalMediaUrl, mediaType, caption);
      }

      // 2. Send direct ephemeral snap to selected friends in parallel
      if (selectedFriends.length > 0) {
        await Promise.all(
          selectedFriends.map((friendUid) => {
            const chatId = getCanonicalChatId(currentUser.uid, friendUid);
            const targetFriend = friends.find((f) => f.uid === friendUid);
            return sendMessage(
              chatId,
              {
                senderId: currentUser.uid,
                senderName: currentUser.displayName,
                type: mediaType,
                content: finalMediaUrl,
                duration: duration === 0 ? 999999 : duration,
                isSaved: false,
              },
              targetFriend || friendUid
            );
          })
        );
      }

      setUploadProgress(100);
      setIsUploading(false);
      onSendComplete({
        target: sendToStory ? 'story' : 'chat',
        friendUid: selectedFriends[0],
      });
    } catch (err: any) {
      console.warn('[Mosa Snap Send] Non-blocking upload fallback:', err?.message || err);
      try {
        if (sendToStory) {
          await publishStory(currentUser, mediaUrl, mediaType, caption);
        }
        if (selectedFriends.length > 0) {
          await Promise.all(
            selectedFriends.map((friendUid) => {
              const chatId = getCanonicalChatId(currentUser.uid, friendUid);
              const targetFriend = friends.find((f) => f.uid === friendUid);
              return sendMessage(
                chatId,
                {
                  senderId: currentUser.uid,
                  senderName: currentUser.displayName,
                  type: mediaType,
                  content: mediaUrl,
                  duration: duration === 0 ? 999999 : duration,
                  isSaved: false,
                },
                targetFriend || friendUid
              );
            })
          );
        }
      } catch (fallbackErr) {
        console.error('Critical snap send failure:', fallbackErr);
      }
      setUploadProgress(100);
      setIsUploading(false);
      onSendComplete({
        target: sendToStory ? 'story' : 'chat',
        friendUid: selectedFriends[0],
      });
    }
  };

  const handleDownload = () => {
    try {
      fetch(mediaUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `snap_${Date.now()}.${mediaType === 'video' ? 'webm' : 'jpg'}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        })
        .catch(() => {
          const a = document.createElement('a');
          a.href = mediaUrl;
          a.download = `snap_${Date.now()}.${mediaType === 'video' ? 'webm' : 'jpg'}`;
          a.click();
        });
    } catch (e) {
      console.warn('Download error:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between text-white overflow-hidden select-none">
      {/* Background Media Preview - object-contain preserves exact capture aspect without zooming or enlarging */}
      <div className="absolute inset-0 flex items-center justify-center bg-black p-0 overflow-hidden">
        {mediaType === 'video' ? (
          <video
            src={mediaUrl}
            autoPlay
            loop
            playsInline
            muted
            className="max-w-full max-h-full w-auto h-auto object-contain select-none"
          />
        ) : (
          <img
            src={mediaUrl}
            alt="Snap Preview"
            className="max-w-full max-h-full w-auto h-auto object-contain select-none"
            onError={(e) => {
              console.warn('Image preview failed to load:', mediaUrl?.slice(0, 50));
            }}
          />
        )}
      </div>

      {/* Floating Caption on Snap */}
      {caption && (
        <div className="absolute top-1/2 left-0 right-0 transform -translate-y-1/2 z-20 flex justify-center px-4 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-md px-5 py-2.5 rounded-full text-white text-center font-medium shadow-xl border border-white/10 max-w-[90%] text-sm sm:text-base">
            {caption}
          </div>
        </div>
      )}

      {/* Top Controls Overlay */}
      <div
        className="relative z-30 w-full flex items-center justify-between p-4 bg-gradient-to-b from-black/70 via-black/20 to-transparent"
        style={{ paddingTop: 'max(1.25rem, calc(env(safe-area-inset-top, 24px) + 0.5rem))' }}
      >
        <button
          onClick={onClose}
          disabled={isUploading}
          className="px-3.5 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center gap-1.5 text-white active:scale-95 transition-transform cursor-pointer font-bold text-xs shadow-lg"
          title="Discard snap and return to camera"
        >
          <X className="w-4 h-4" />
          <span>Discard</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Caption Edit Toggle */}
          <button
            onClick={() => setShowCaptionInput(!showCaptionInput)}
            className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer ${
              showCaptionInput
                ? 'bg-yellow-400 text-black border-yellow-300'
                : 'bg-black/40 text-white border-white/20'
            }`}
          >
            <Type className="w-5 h-5" />
          </button>

          {/* Ephemeral Timer Duration Selector */}
          <button
            onClick={() => setShowTimerPicker(!showTimerPicker)}
            className={`px-3 h-10 rounded-full backdrop-blur-md border flex items-center gap-1.5 transition-all cursor-pointer ${
              showTimerPicker
                ? 'bg-purple-600 text-white border-purple-400'
                : 'bg-black/40 text-white border-white/20'
            }`}
          >
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold">
              {duration === 0 ? '∞' : `${duration}s`}
            </span>
          </button>

          {/* Save to Device */}
          <button
            onClick={handleDownload}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Caption Text Input Popover */}
      {showCaptionInput && (
        <div className="relative z-30 w-full px-6 py-2">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a snap caption..."
            autoFocus
            className="w-full bg-black/80 backdrop-blur-xl border border-white/30 rounded-2xl px-4 py-3 text-white placeholder-white/50 text-center outline-none focus:border-yellow-400 transition-colors shadow-2xl text-base"
          />
        </div>
      )}

      {/* Timer Picker Selector Bar */}
      {showTimerPicker && (
        <div className="relative z-30 bg-black/80 backdrop-blur-xl border border-white/20 rounded-full px-4 py-2 flex items-center gap-4 my-2 shadow-2xl">
          <span className="text-xs text-white/60 font-medium">Snap Duration:</span>
          {timerOptions.map((t) => (
            <button
              key={t}
              onClick={() => {
                setDuration(t);
                setShowTimerPicker(false);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                duration === t
                  ? 'bg-purple-500 text-white scale-110 shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {t === 0 ? '∞' : t}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Send Action Bar */}
      <div className="relative z-30 w-full p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 text-white/80 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Direct-to-Storage
          </span>
        </div>

        <button
          onClick={() => setShowSendDrawer(true)}
          className="flex items-center gap-2.5 bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-3.5 rounded-full font-bold shadow-xl active:scale-95 transition-all cursor-pointer"
        >
          <span>Send To</span>
          <Send className="w-4 h-4 fill-black" />
        </button>
      </div>

      {/* Send To Drawer Modal */}
      {showSendDrawer && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSendDrawer(false);
          }}
          className="absolute inset-0 z-40 bg-black/70 backdrop-blur-md flex flex-col justify-end cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#121216] border-t border-white/15 rounded-t-3xl p-5 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 cursor-default"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-yellow-400" /> Send Snap
              </h3>
              <button
                onClick={() => setShowSendDrawer(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-transform"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stories Section */}
            <div className="py-4 border-b border-white/10">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Stories (24h TTL)
              </span>
              <div
                onClick={() => setSendToStory(!sendToStory)}
                className={`mt-2.5 p-3 rounded-2xl flex items-center justify-between cursor-pointer border transition-all ${
                  sendToStory
                    ? 'bg-yellow-400/10 border-yellow-400/40 text-yellow-300'
                    : 'bg-white/5 border-white/5 text-white/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 p-0.5 flex items-center justify-center">
                    <img
                      src={currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">My Story</p>
                    <p className="text-xs text-white/50">Disappears automatically after 24 hours</p>
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                    sendToStory
                      ? 'bg-yellow-400 border-yellow-400 text-black'
                      : 'border-white/30'
                  }`}
                >
                  {sendToStory && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* Direct Snaps to Friends */}
            <div className="py-4 flex-1 overflow-y-auto scroll-touch" style={{ touchAction: 'pan-y' }}>
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Direct Friends (Ephemeral)
              </span>
              <div className="mt-2.5 space-y-2">
                {friends.map((friend) => {
                  const isSelected = selectedFriends.includes(friend.uid);
                  return (
                    <div
                      key={friend.uid}
                      onClick={() => toggleFriend(friend.uid)}
                      className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer border transition-all ${
                        isSelected
                          ? 'bg-purple-500/15 border-purple-500/40'
                          : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={friend.photoURL || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'}
                          alt={friend.displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-semibold text-sm text-white">{friend.displayName}</p>
                          <p className="text-xs text-white/40">@{friend.username}</p>
                        </div>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                          isSelected
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : 'border-white/30'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Uploading progress indicator */}
            {isUploading && (
              <div className="py-3">
                <div className="flex justify-between text-xs text-white/70 mb-1">
                  <span>Pushing Direct-to-Storage...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Send Confirm Button */}
            <button
              onClick={handleSend}
              disabled={isUploading || (!sendToStory && selectedFriends.length === 0)}
              className="mt-2 w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <span>Uploading Direct to Bucket...</span>
              ) : (
                <>
                  <span>
                    Send{' '}
                    {sendToStory && selectedFriends.length > 0
                      ? `to Story & ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}`
                      : sendToStory
                      ? 'to My Story'
                      : `to ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}`}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Back / Cancel Button */}
            <button
              type="button"
              onClick={() => setShowSendDrawer(false)}
              className="mt-2.5 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-98 text-white/70 hover:text-white font-semibold text-xs transition-colors cursor-pointer text-center"
            >
              Back to Editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
