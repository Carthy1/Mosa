'use client';

import React, { useState, useEffect } from 'react';
import { Story, UserProfile } from '@/types';
import { subscribeStories, publishStory } from '@/lib/firebase/firestore';
import { StoryViewerModal } from './StoryViewerModal';
import {
  Plus,
  Clock,
  Sparkles,
  Flame,
  Compass,
  Play,
  Share2,
  TrendingUp,
} from 'lucide-react';

interface StoriesPaneProps {
  currentUser: UserProfile;
  friends: UserProfile[];
  onOpenCamera: () => void;
  onOpenAuth?: () => void;
}

export function StoriesPane({ currentUser, friends, onOpenCamera, onOpenAuth }: StoriesPaneProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeStories((updatedStories) => {
      setStories(updatedStories);
    });
    return () => unsubscribe();
  }, []);

  // Filter My Stories vs Friends Stories
  const myStories = stories.filter((s) => s.authorId === currentUser.uid);
  const friendsStories = stories.filter((s) => s.authorId !== currentUser.uid);

  return (
    <div className="w-full h-full bg-[#0a0a0f] text-white flex flex-col overflow-y-auto pb-24 scroll-touch" style={{ touchAction: 'pan-y' }}>
      {/* Top Header */}
      <div
        className="sticky top-0 z-20 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/10 px-5 pb-4 flex items-center justify-between"
        style={{ paddingTop: 'max(2.75rem, calc(env(safe-area-inset-top, 24px) + 0.75rem))' }}
      >
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
              Mosa
            </span>
            <span>Stories</span>
            <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-bold">
              24h TTL
            </span>
          </h1>
          <p className="text-xs text-white/50">Disappearing community moments</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenCamera}
            className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Snap</span>
          </button>

          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="w-9 h-9 rounded-full border-2 border-yellow-400 overflow-hidden bg-white/10 shadow-lg active:scale-95 transition-transform cursor-pointer flex-shrink-0"
              title="Manage Account"
            >
              <img
                src={currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                alt={currentUser.displayName}
                className="w-full h-full object-cover"
              />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* 1. My Story Banner / Circular Badge */}
        <div>
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
            My Story
          </span>

          <div className="mt-2.5 flex items-center gap-4 bg-white/5 border border-white/10 p-3.5 rounded-2xl backdrop-blur-md">
            <div className="relative">
              <div
                onClick={() => {
                  if (myStories.length > 0) setSelectedStoryIndex(0);
                  else onOpenCamera();
                }}
                className={`w-16 h-16 rounded-full p-1 cursor-pointer transition-transform active:scale-95 ${
                  myStories.length > 0
                    ? 'bg-gradient-to-tr from-yellow-400 via-amber-500 to-purple-600'
                    : 'border-2 border-dashed border-white/30'
                }`}
              >
                <img
                  src={
                    myStories[0]?.mediaUrl ||
                    currentUser.photoURL ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                  }
                  alt="My Story"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>

              {/* Plus badge */}
              <button
                onClick={onOpenCamera}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>

            <div className="flex-1">
              <h3 className="font-bold text-sm text-white">
                {myStories.length > 0 ? 'My Active Story' : 'Add to My Story'}
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                {myStories.length > 0
                  ? `${myStories.length} active slide${myStories.length > 1 ? 's' : ''} • Auto-expires in 24h`
                  : 'Capture an AR filter photo or video snap'}
              </p>

              {myStories.length > 0 && (
                <button
                  onClick={() => setSelectedStoryIndex(0)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-yellow-400 font-semibold hover:underline cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-yellow-400" /> Watch Story
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Friends Stories Circular Carousel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
              Friends Updates ({friendsStories.length})
            </span>
          </div>

          {friendsStories.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
              <Sparkles className="w-8 h-8 text-yellow-400/50 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white/80">No stories yet</p>
              <p className="text-xs text-white/40 mt-1">Be the first to post a 24h snap!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {friendsStories.map((story, idx) => (
                <div
                  key={story.id}
                  onClick={() => setSelectedStoryIndex(myStories.length + idx)}
                  className="group relative aspect-[9/14] rounded-2xl overflow-hidden bg-black cursor-pointer border border-white/10 hover:border-yellow-400/50 transition-all duration-300 shadow-xl"
                >
                  {/* Story Thumbnail */}
                  {story.type === 'video' ? (
                    <video
                      src={story.mediaUrl}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <img
                      src={story.mediaUrl}
                      alt={story.authorName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}

                  {/* Gradient overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40" />

                  {/* Top Author avatar with glowing border */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 to-purple-500 shadow-md">
                      <img
                        src={
                          story.authorAvatar ||
                          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
                        }
                        alt={story.authorName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Bottom details */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="font-bold text-xs text-white truncate drop-shadow">
                      {story.authorName}
                    </p>
                    {story.caption && (
                      <p className="text-[11px] text-white/70 line-clamp-1 mt-0.5">
                        {story.caption}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-yellow-400/80 mt-1 font-medium">
                      <Clock className="w-2.5 h-2.5" />
                      <span>TTL Active</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Discover Ephemeral Community Showcase */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
              Discover & Trending Snaps
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 backdrop-blur-md">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                    FEATURED LENS
                  </span>
                  <h4 className="font-bold text-sm text-white mt-2">Cyberpunk 2077 Visor</h4>
                  <p className="text-xs text-white/60 mt-1">
                    Powered by MediaPipe 478 Face Mesh & Three.js WebGL GPU pipeline.
                  </p>
                </div>
                <button
                  onClick={onOpenCamera}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-xs font-bold shadow active:scale-95 transition-transform cursor-pointer"
                >
                  Try Lens
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen Story Viewer Modal */}
      {selectedStoryIndex !== null && (
        <StoryViewerModal
          stories={stories}
          initialIndex={selectedStoryIndex}
          currentUser={currentUser}
          onClose={() => setSelectedStoryIndex(null)}
        />
      )}
    </div>
  );
}
