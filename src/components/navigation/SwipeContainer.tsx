'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChatPane } from '../chat/ChatPane';
import { ARCamera } from '../camera/ARCamera';
import { StoriesPane } from '../stories/StoriesPane';
import { QAAuditModal } from '../qa/QAAuditModal';
import { AuthModal } from '../auth/AuthModal';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, Chat, Story } from '@/types';
import { mockStore, DEFAULT_USER } from '@/lib/mock/mockStore';
import { subscribeChats, subscribeStories } from '@/lib/firebase/firestore';
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
  const [currentUser, setCurrentUser] = useState<UserProfile>(authUser || DEFAULT_USER);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unopenedSnapsCount, setUnopenedSnapsCount] = useState(0);
  const [unseenStoriesCount, setUnseenStoriesCount] = useState(0);
  const [showQAModal, setShowQAModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (authUser) {
      mockStore.updateCurrentUser(authUser);
      setCurrentUser(authUser);
    }
  }, [authUser]);

  useEffect(() => {
    // Load initial user and friends
    const user = authUser || mockStore.getCurrentUser();
    setCurrentUser(user);
    setFriends(mockStore.getFriends());

    // Listen for mock store updates
    const unsubscribeStore = mockStore.subscribe(() => {
      setCurrentUser(authUser || mockStore.getCurrentUser());
      setFriends(mockStore.getFriends());
    });

    // Listen for chats to count unopened snaps
    const unsubscribeChats = subscribeChats(user.uid, (chats) => {
      const unopened = chats.filter(
        (c) =>
          c.lastMessage &&
          (c.lastMessage.type === 'image' || c.lastMessage.type === 'video') &&
          c.lastMessage.viewStatus === 'delivered' &&
          c.lastMessage.senderId !== user.uid
      ).length;
      setUnopenedSnapsCount(unopened);
    });

    // Listen for stories
    const unsubscribeStories = subscribeStories((stories) => {
      const unseen = stories.filter(
        (s) => s.authorId !== user.uid && !s.viewedBy?.includes(user.uid)
      ).length;
      setUnseenStoriesCount(unseen);
    });

    return () => {
      unsubscribeStore();
      unsubscribeChats();
      unsubscribeStories();
    };
  }, []);

  // Handle Drag Gesture end
  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 50;
    const velocityThreshold = 400;

    if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      // Swiped Left -> Move Right (e.g. Chat -> Camera or Camera -> Stories)
      setActivePane((prev) => Math.min(prev + 1, 2));
    } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      // Swiped Right -> Move Left (e.g. Stories -> Camera or Camera -> Chat)
      setActivePane((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col select-none">
      {/* 3-Pane Horizontal Carousel Engine */}
      {/* Built strictly with Framer Motion, avoiding Next.js route changes so Camera is never unmounted! */}
      <motion.div
        className="flex w-[300vw] h-full"
        animate={{ x: `-${activePane * 100}vw` }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
        drag={isChatOpen && activePane === 0 ? false : "x"}
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
            onOpenCamera={() => setActivePane(1)}
            onOpenAuth={() => setShowAuthModal(true)}
            onActiveChatChange={(isOpen) => setIsChatOpen(isOpen)}
          />
        </div>

        {/* Pane 1: Camera (Center) */}
        <div className="w-[100vw] h-full flex-shrink-0 relative overflow-hidden">
          <ARCamera
            isActive={activePane === 1}
            currentUser={currentUser}
            friends={friends}
            onOpenQAAudit={() => setShowQAModal(true)}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        </div>

        {/* Pane 2: Stories (Right) */}
        <div className="w-[100vw] h-full flex-shrink-0 relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
          <StoriesPane
            currentUser={currentUser}
            friends={friends}
            onOpenCamera={() => setActivePane(1)}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        </div>
      </motion.div>

      {/* Floating Modern Bottom Navigation Bar (Hidden when actively chatting to prevent obscuring input) */}
      {!(activePane === 0 && isChatOpen) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-auto flex justify-center pb-5 px-6 animate-in fade-in duration-200">
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
    </div>
  );
}
