'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChatPane } from '../chat/ChatPane';
import { ARCamera } from '../camera/ARCamera';
import { StoriesPane } from '../stories/StoriesPane';
import { QAAuditModal } from '../qa/QAAuditModal';
import { AuthModal } from '../auth/AuthModal';
import { InAppNotificationToast, InAppNotificationData } from '../common/InAppNotificationToast';
import {
  playNotificationSound,
  triggerHaptic,
  sendNativeNotification,
  registerNotificationServiceWorker,
} from '@/lib/notifications';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, Chat, Story } from '@/types';
import { mockStore, DEFAULT_USER } from '@/lib/mock/mockStore';
import { subscribeChats, subscribeStories, saveUserProfile, subscribeUserFriends } from '@/lib/firebase/firestore';
import {
  MessageSquare,
  Camera,
  PlaySquare,
  Sparkles,
  ShieldCheck,
  Search,
  User,
} from 'lucide-react';

export function SwipeContainer() {
  const { user: authUser } = useAuth();
  // 0: Chat (Left), 1: Camera (Center), 2: Stories (Right)
  const [activePane, setActivePane] = useState<number>(1);
  const [cameraTargetUser, setCameraTargetUser] = useState<UserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile>(authUser || DEFAULT_USER);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentOpenChatId, setCurrentOpenChatId] = useState<string | null>(null);
  const [targetChatIdToOpen, setTargetChatIdToOpen] = useState<string | null>(null);
  const [activeNotification, setActiveNotification] = useState<InAppNotificationData | null>(null);
  const [unopenedSnapsCount, setUnopenedSnapsCount] = useState(0);
  const [unseenStoriesCount, setUnseenStoriesCount] = useState(0);
  const [showQAModal, setShowQAModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const knownMessagesRef = useRef<Map<string, { id?: string; createdAt?: number }>>(new Map());
  const isFirstChatsRunRef = useRef(true);

  useEffect(() => {
    if (authUser) {
      mockStore.setCurrentUser(authUser);
      setCurrentUser(authUser);
      saveUserProfile(authUser);
    }
  }, [authUser]);

  useEffect(() => {
    // Load initial user
    const user = authUser || mockStore.getCurrentUser();
    setCurrentUser(user);
    saveUserProfile(user);

    // Subscribe to real friends list for this user
    const unsubscribeFriends = subscribeUserFriends(user.uid, (realFriends) => {
      setFriends(realFriends);
    });

    // Listen for mock store updates in offline mode
    const unsubscribeStore = mockStore.subscribe(() => {
      if (authUser) {
        setCurrentUser(authUser);
      } else {
        setCurrentUser(mockStore.getCurrentUser());
        setFriends(mockStore.getFriends());
      }
    });

    // Register Service Worker for push notifications
    registerNotificationServiceWorker();

    // Listen for chats to count unopened snaps & trigger real-time alerts
    const unsubscribeChats = subscribeChats(user.uid, (chats) => {
      const unopened = chats.filter(
        (c) =>
          c.lastMessage &&
          (c.lastMessage.type === 'image' || c.lastMessage.type === 'video') &&
          c.lastMessage.viewStatus === 'delivered' &&
          c.lastMessage.senderId !== user.uid
      ).length;
      setUnopenedSnapsCount(unopened);

      // Real-Time Notification Logic
      chats.forEach((chat) => {
        const lastMsg = chat.lastMessage;
        if (!lastMsg || lastMsg.senderId === user.uid) return;

        const prev = knownMessagesRef.current.get(chat.id);
        const isNew =
          !prev ||
          (lastMsg.id && prev.id !== lastMsg.id) ||
          (lastMsg.createdAt && (!prev.createdAt || lastMsg.createdAt > prev.createdAt));

        if (isNew) {
          knownMessagesRef.current.set(chat.id, {
            id: lastMsg.id,
            createdAt: lastMsg.createdAt,
          });

          // Only fire notification if not the initial subscription snapshot
          if (!isFirstChatsRunRef.current) {
            // If user is already inside this exact chat, don't show a redundant banner
            const isLookingAtChat =
              activePane === 0 && isChatOpen && currentOpenChatId === chat.id;

            if (!isLookingAtChat) {
              const senderProfile =
                (chat.participantProfiles && chat.participantProfiles[lastMsg.senderId]) ||
                friends.find((f) => f.uid === lastMsg.senderId);

              const senderName =
                senderProfile?.displayName ||
                lastMsg.senderName ||
                'A friend';
              const senderPhoto = senderProfile?.photoURL;

              // 1. Play audio chime
              playNotificationSound();

              // 2. Trigger subtle haptics
              triggerHaptic();

              // 3. Dispatch native browser notification
              const notifTitle = `New message from ${senderName}`;
              const notifBody =
                lastMsg.type === 'image'
                  ? '📸 Sent a photo snap'
                  : lastMsg.type === 'video'
                  ? '🎥 Sent a video snap'
                  : lastMsg.content || 'New message';

              sendNativeNotification(notifTitle, {
                body: notifBody,
                tag: chat.id,
                onClick: () => {
                  setActivePane(0);
                  setTargetChatIdToOpen(chat.id);
                },
              });

              // 4. Show top in-app notification toast
              setActiveNotification({
                id: lastMsg.id || `notif_${Date.now()}`,
                chatId: chat.id,
                senderId: lastMsg.senderId,
                senderName,
                senderPhoto,
                content: lastMsg.content,
                type: lastMsg.type,
                createdAt: lastMsg.createdAt,
              });
            }
          }
        }
      });

      isFirstChatsRunRef.current = false;
    });

    // Listen for stories
    const unsubscribeStories = subscribeStories((stories) => {
      const unseen = stories.filter(
        (s) => s.authorId !== user.uid && !s.viewedBy?.includes(user.uid)
      ).length;
      setUnseenStoriesCount(unseen);
    });

    return () => {
      unsubscribeFriends();
      unsubscribeStore();
      unsubscribeChats();
      unsubscribeStories();
    };
  }, [authUser, activePane, isChatOpen, currentOpenChatId, friends]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowQAModal(false);
        setShowAuthModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Drag Gesture end
  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 50;
    const velocityThreshold = 400;

    if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      // Swiped Left -> Move Right (e.g. Camera -> Stories)
      setActivePane((prev) => Math.min(prev + 1, 2));
    } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      // Swiped Right -> Move Left (e.g. Camera -> Chat)
      setActivePane((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="relative w-full h-full h-[100dvh] overflow-hidden bg-black flex flex-col select-none">
      {/* 3-Pane Horizontal Carousel Engine */}
      {/* Built strictly with Framer Motion, avoiding Next.js route changes so Camera is never unmounted! */}
      <motion.div
        className="flex w-[300vw] h-full"
        animate={{ x: `-${activePane * 100}vw` }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
        drag={activePane === 1 ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Pane 0: Chat (Left) */}
        <div className="w-[100vw] h-full flex-shrink-0 relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
          <ChatPane
            currentUser={currentUser}
            friends={friends}
            onOpenCamera={(targetUser) => {
              setCameraTargetUser(targetUser || null);
              setActivePane(1);
            }}
            onOpenAuth={() => setShowAuthModal(true)}
            onActiveChatChange={(isOpen, activeChatId) => {
              setIsChatOpen(isOpen);
              setCurrentOpenChatId(activeChatId || null);
            }}
            targetChatIdToOpen={targetChatIdToOpen}
            onTargetChatOpened={() => setTargetChatIdToOpen(null)}
          />
        </div>

        {/* Pane 1: Camera (Center) */}
        <div className="w-[100vw] h-full flex-shrink-0 relative overflow-hidden">
          <ARCamera
            isActive={activePane === 1}
            currentUser={currentUser}
            friends={friends}
            defaultRecipient={cameraTargetUser}
            unopenedSnapsCount={unopenedSnapsCount}
            unseenStoriesCount={unseenStoriesCount}
            onNavigateToChat={() => setActivePane(0)}
            onNavigateToStories={() => setActivePane(2)}
            onOpenQAAudit={() => setShowQAModal(true)}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        </div>

        {/* Pane 2: Stories (Right) */}
        <div className="w-[100vw] h-full flex-shrink-0 relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
          <StoriesPane
            currentUser={currentUser}
            friends={friends}
            onOpenCamera={() => {
              setCameraTargetUser(null);
              setActivePane(1);
            }}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        </div>
      </motion.div>

      {/* Floating Bottom Navigation Bar: visible on Chat (Pane 0) and Stories (Pane 2); hidden on Camera (Pane 1) to give the Shutter button 100% unobstructed room */}
      {!(activePane === 1 || (activePane === 0 && isChatOpen)) && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 pointer-events-auto flex justify-center px-6 animate-in fade-in duration-200"
          style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 20px) + 0.5rem))' }}
        >
          <div className="bg-black/60 backdrop-blur-2xl border border-white/15 px-6 py-2.5 rounded-full flex items-center gap-8 shadow-2xl">
          {/* Chat Tab (Left) */}
          <button
            onClick={() => setActivePane(0)}
            className={`relative flex flex-col items-center transition-all cursor-pointer ${
              activePane === 0 ? 'text-purple-400 scale-110' : 'text-white/60 hover:text-white'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {unopenedSnapsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border border-black" />
              )}
            </div>
            <span className="text-[10px] font-bold mt-0.5">Chat</span>
          </button>

          {/* Camera Tab (Center) */}
          <button
            onClick={() => setActivePane(1)}
            className={`relative flex flex-col items-center transition-all cursor-pointer ${
              activePane === 1 ? 'text-yellow-400 scale-110' : 'text-white/60 hover:text-white'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activePane === 1
                  ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/40'
                  : 'bg-white/10 text-white'
              }`}
            >
              <Camera className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-bold mt-0.5">Camera</span>
          </button>

          {/* Stories Tab (Right) */}
          <button
            onClick={() => setActivePane(2)}
            className={`relative flex flex-col items-center transition-all cursor-pointer ${
              activePane === 2 ? 'text-purple-400 scale-110' : 'text-white/60 hover:text-white'
            }`}
          >
            <div className="relative">
              <PlaySquare className="w-5 h-5" />
              {unseenStoriesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-yellow-400 border border-black" />
              )}
            </div>
            <span className="text-[10px] font-bold mt-0.5">Stories</span>
          </button>
        </div>
      </div>
      )}

      {/* QA & Testing Modal */}
      {showQAModal && (
        <QAAuditModal
          onClose={() => setShowQAModal(false)}
          activePane={activePane}
        />
      )}

      {/* Firebase Auth & Profile Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {/* Top Floating In-App Notification Toast */}
      <InAppNotificationToast
        notification={activeNotification}
        onOpenChat={(chatId) => {
          setActiveNotification(null);
          setActivePane(0);
          setTargetChatIdToOpen(chatId);
        }}
        onDismiss={() => setActiveNotification(null)}
      />
    </div>
  );
}
