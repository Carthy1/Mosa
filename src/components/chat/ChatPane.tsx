'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message, UserProfile } from '@/types';
import {
  subscribeChats,
  subscribeMessages,
  sendMessage,
  setTypingStatus,
  addFriend,
  markChatMessagesAsRead,
  getCanonicalChatId,
} from '@/lib/firebase/firestore';
import { DEMO_FRIENDS, mockStore } from '@/lib/mock/mockStore';
import { EphemeralViewerModal } from '../snap/EphemeralViewerModal';
import {
  MessageSquare,
  Search,
  UserPlus,
  Camera,
  Send,
  Flame,
  Clock,
  ArrowLeft,
  CheckCheck,
  Sparkles,
  Square,
  Eye,
  X,
  CornerUpLeft,
  Bookmark,
  Download,
  Check,
} from 'lucide-react';

interface ChatPaneProps {
  currentUser: UserProfile;
  friends: UserProfile[];
  onOpenCamera: (targetUser?: UserProfile) => void;
  onOpenAuth?: () => void;
  onActiveChatChange?: (isActive: boolean) => void;
}

export function ChatPane({
  currentUser,
  friends,
  onOpenCamera,
  onOpenAuth,
  onActiveChatChange,
}: ChatPaneProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [viewingSnap, setViewingSnap] = useState<{ message: Message; senderName: string } | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsernameInput, setFriendUsernameInput] = useState('');
  const [friendAddStatus, setFriendAddStatus] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatReceiptTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDownloadMedia = (mediaUrl: string, type: string) => {
    try {
      const filename = `mosa_snap_${Date.now()}.${type === 'video' ? 'webm' : 'jpg'}`;
      fetch(mediaUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        })
        .catch(() => {
          const a = document.createElement('a');
          a.href = mediaUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });
    } catch (e) {
      console.warn('Failed to download media:', e);
    }
  };

  const handleStartReply = (msg: Message) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(msgId);
      setTimeout(() => setHighlightedMessageId(null), 1800);
    }
  };

  // Notify parent container when inside a conversation
  useEffect(() => {
    onActiveChatChange?.(Boolean(activeChat));
  }, [activeChat, onActiveChatChange]);

  // Subscribe to real-time chat list
  useEffect(() => {
    const unsubscribe = subscribeChats(currentUser.uid, (updatedChats) => {
      setChats(updatedChats);
    });
    return () => unsubscribe();
  }, [currentUser.uid]);

  // Subscribe to active chat messages & immediately mark incoming as viewed
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    markChatMessagesAsRead(activeChat.id, currentUser.uid);

    const unsubscribe = subscribeMessages(activeChat.id, (msgs) => {
      setMessages(msgs);
      markChatMessagesAsRead(activeChat.id, currentUser.uid);
    });

    return () => unsubscribe();
  }, [activeChat, currentUser.uid]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get recipient profile for a chat
  const getRecipient = (chat: Chat): UserProfile => {
    const otherUid = chat.participants.find((id) => id !== currentUser.uid) || chat.participants[0] || 'user_elena';

    // 1. Check if recipient profile exists on chat document
    const details = chat.participantProfiles?.[otherUid] || chat.participantDetails?.[otherUid];
    if (details) {
      return {
        uid: otherUid,
        displayName: details.displayName || otherUid,
        username: details.username || otherUid.toLowerCase(),
        photoURL: details.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        friends: [],
        createdAt: Date.now(),
      };
    }

    // 2. Check in friends array
    const friend = friends.find((f) => f.uid === otherUid || otherUid.includes(f.uid));
    if (friend) return friend;

    // 3. Direct check in DEMO_FRIENDS
    if (DEMO_FRIENDS[otherUid]) return DEMO_FRIENDS[otherUid];
    for (const key of Object.keys(DEMO_FRIENDS)) {
      if (chat.id.includes(key.replace('user_', '')) || otherUid.includes(key.replace('user_', ''))) {
        return DEMO_FRIENDS[key];
      }
    }

    // 4. Direct check in mockStore
    const storeUser = mockStore.getUser(otherUid);
    if (storeUser) return storeUser;

    return {
      uid: otherUid,
      username: otherUid.replace('user_', ''),
      displayName: otherUid.replace('user_', '').replace('_', ' '),
      photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
      friends: [],
      createdAt: Date.now(),
    };
  };

  /**
   * Section 5.4: Debounced typing indicator
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!activeChat) return;

    if (!isTyping && val.trim().length > 0) {
      setIsTyping(true);
      setTypingStatus(activeChat.id, currentUser.uid, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (activeChat) {
        setTypingStatus(activeChat.id, currentUser.uid, false);
      }
    }, 1500);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const content = inputText.trim();
    setInputText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    setTypingStatus(activeChat.id, currentUser.uid, false);

    const replyPayload = replyingTo
      ? {
          messageId: replyingTo.id,
          senderName: replyingTo.senderName || (replyingTo.senderId === currentUser.uid ? 'You' : 'Friend'),
          senderId: replyingTo.senderId,
          content: replyingTo.type === 'text' ? replyingTo.content : `[${replyingTo.type.toUpperCase()} SNAP]`,
          type: replyingTo.type,
        }
      : undefined;

    setReplyingTo(null);

    // 1. Optimistic UI insertion for instant feedback
    const tempMsg: Message = {
      id: `local_${Date.now()}`,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      type: 'text',
      content,
      viewStatus: 'delivered',
      createdAt: Date.now(),
      replyTo: replyPayload,
    };
    setMessages((prev) => [...prev, tempMsg]);

    // 2. Perform message dispatch
    const recipient = getRecipient(activeChat);
    const sent = await sendMessage(
      activeChat.id,
      {
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        type: 'text',
        content,
        replyTo: replyPayload,
      },
      recipient
    );

    // Replace optimistic placeholder with confirmed message
    setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? sent : m)));

    // 3. Realistic Demo Simulation for seed friends only
    if (DEMO_FRIENDS[recipient.uid]) {
      const otherUid = recipient.uid;
      const targetChatId = activeChat.id;
      setTimeout(() => {
        // Friend views your message (triggers "Seen" read receipt)
        markChatMessagesAsRead(targetChatId, otherUid);
        setTypingStatus(targetChatId, otherUid, true);
        setTimeout(async () => {
          setTypingStatus(targetChatId, otherUid, false);
          const replies = [
            'Love this! Did you check out the new AR filter in the camera? ⚡',
            'That looks awesome! Send me an ephemeral snap! 🔥',
            'Got your message! Testing the real-time chat sync 😎',
            'Haha nice! Loving the new 3-pane carousel transition ✨',
          ];
          const randomReply = replies[Math.floor(Math.random() * replies.length)];
          await sendMessage(targetChatId, {
            senderId: otherUid,
            senderName: recipient.displayName,
            type: 'text',
            content: randomReply,
            replyTo: {
              messageId: sent.id,
              senderId: currentUser.uid,
              senderName: currentUser.displayName,
              content: sent.content,
              type: sent.type,
            },
          });
        }, 1800);
      }, 900);
    }
  };

  const handleAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendUsernameInput.trim()) return;

    setFriendAddStatus('Searching...');
    const result = await addFriend(friendUsernameInput.trim(), currentUser.uid);
    if (result) {
      setFriendAddStatus(`Added @${result.username}! Opening conversation...`);
      setFriendUsernameInput('');

      const canonicalId = getCanonicalChatId(currentUser.uid, result.uid);
      const targetChat: Chat = {
        id: canonicalId,
        participants: [currentUser.uid, result.uid],
        participantProfiles: {
          [currentUser.uid]: currentUser,
          [result.uid]: result,
        },
        updatedAt: Date.now(),
      };

      setTimeout(() => {
        setShowAddFriend(false);
        setFriendAddStatus(null);
        setActiveChat(targetChat);
      }, 700);
    } else {
      setFriendAddStatus('User not found. Try their exact username or email.');
    }
  };

  return (
    <div className="w-full h-full bg-[#0d0d12] text-white flex flex-col overflow-hidden">
      {/* 1. Main Chat List View */}
      {!activeChat ? (
        <div className="flex flex-col h-full overflow-y-auto pb-24 scroll-touch" style={{ touchAction: 'pan-y' }}>
          {/* Header */}
          <div className="sticky top-0 z-20 bg-[#0d0d12]/80 backdrop-blur-xl border-b border-white/10 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400">
                  Mosa
                </span>
                <span>Chat</span>
                <span className="text-xs bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                  Ephemeral
                </span>
              </h1>
              <p className="text-xs text-white/50">Disappearing snaps & messages</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddFriend(true)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Add Friend"
              >
                <UserPlus className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenAuth}
                className="w-10 h-10 rounded-full border-2 border-purple-500 overflow-hidden bg-white/10 shadow-lg active:scale-95 transition-transform cursor-pointer flex-shrink-0"
                title="Manage Firebase Account / Profiles"
              >
                <img
                  src={currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                  alt={currentUser.displayName}
                  className="w-full h-full object-cover"
                />
              </button>
            </div>
          </div>

          {/* Quick Start Snapping Carousel */}
          <div className="p-4 border-b border-white/5 bg-gradient-to-r from-purple-950/20 to-transparent">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
                Quick Snap
              </span>
              <button
                onClick={onOpenCamera}
                className="text-xs text-yellow-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Open Camera
              </button>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 scroll-touch-x" style={{ touchAction: 'pan-x' }}>
              {friends.map((friend) => (
                <div
                  key={friend.uid}
                  onClick={() => {
                    const canonicalId = getCanonicalChatId(currentUser.uid, friend.uid);
                    const existing = chats.find(
                      (c) => c.id === canonicalId || c.participants.includes(friend.uid)
                    );
                    if (existing) {
                      setActiveChat(existing);
                    } else {
                      const newChat: Chat = {
                        id: canonicalId,
                        participants: [currentUser.uid, friend.uid],
                        participantProfiles: {
                          [currentUser.uid]: currentUser,
                          [friend.uid]: friend,
                        },
                        updatedAt: Date.now(),
                      };
                      setActiveChat(newChat);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 cursor-pointer group flex-shrink-0"
                >
                  <div className="relative">
                    <img
                      src={
                        friend.photoURL ||
                        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
                      }
                      alt={friend.displayName}
                      className="w-13 h-13 rounded-full object-cover border-2 border-white/20 group-hover:border-yellow-400 transition-colors"
                    />
                    {friend.streak && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black font-extrabold text-[10px] px-1.5 py-0.2 rounded-full border border-black flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 fill-current" />
                        {friend.streak}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-white/70 group-hover:text-white max-w-[60px] truncate text-center">
                    {friend.displayName.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Conversations Thread List */}
          <div className="divide-y divide-white/5 flex-1">
            {chats.length === 0 ? (
              <div className="p-8 text-center text-white/40">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Add a friend or send a snap to start chatting!</p>
              </div>
            ) : (
              chats.map((chat) => {
                const recipient = getRecipient(chat);
                const lastMsg = chat.lastMessage;
                const isSentByMe = Boolean(lastMsg && lastMsg.senderId === currentUser.uid);
                const isRepliedToMe = Boolean(
                  lastMsg &&
                  !isSentByMe &&
                  lastMsg.isReply &&
                  lastMsg.replyToSenderId === currentUser.uid
                );
                const isUnopenedSnap =
                  lastMsg &&
                  (lastMsg.type === 'image' || lastMsg.type === 'video') &&
                  lastMsg.viewStatus === 'delivered' &&
                  !isSentByMe;

                // Check other user typing indicator
                const otherUid = recipient.uid;
                const otherIsTyping = Boolean(chat.typing && chat.typing[otherUid]);

                return (
                  <div
                    key={chat.id}
                    onClick={() => setActiveChat(chat)}
                    className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:bg-white/10"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <img
                          src={
                            recipient.photoURL ||
                            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
                          }
                          alt={recipient.displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        {recipient.streak && (
                          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black font-extrabold text-[9px] px-1 py-0.1 rounded-full border border-black flex items-center">
                            🔥{recipient.streak}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-white truncate">
                          {recipient.displayName}
                        </h3>

                        {otherIsTyping ? (
                          <p className="text-xs text-purple-400 font-semibold animate-pulse flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                            Typing...
                          </p>
                        ) : isUnopenedSnap ? (
                          <p className="text-xs text-red-400 font-bold flex items-center gap-1.5 mt-0.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-red-500 animate-pulse shadow-sm shadow-red-500" />
                            <span>New {lastMsg.type.toUpperCase()} Snap • Tap to view</span>
                          </p>
                        ) : isRepliedToMe ? (
                          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-purple-500/25 text-purple-300 font-bold text-[10px] border border-purple-500/40 flex-shrink-0">
                              <CornerUpLeft className="w-2.5 h-2.5 stroke-[2.5]" />
                              Replied to you
                            </span>
                            <span className="text-xs text-white/70 truncate">{lastMsg.content}</span>
                          </div>
                        ) : isSentByMe && lastMsg ? (
                          lastMsg.type === 'text' ? (
                            lastMsg.viewStatus === 'viewed' ? (
                              <p className="text-xs text-sky-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                                <CheckCheck className="w-3.5 h-3.5 stroke-[2.5] flex-shrink-0" />
                                <span>Seen · {formatReceiptTime(lastMsg.viewedAt || lastMsg.createdAt)}</span>
                              </p>
                            ) : (
                              <p className="text-xs text-white/50 flex items-center gap-1 mt-0.5 truncate">
                                <CheckCheck className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
                                <span>Delivered</span>
                                <span className="text-white/30 truncate ml-1">"{lastMsg.content}"</span>
                              </p>
                            )
                          ) : lastMsg.isSaved ? (
                            <p className="text-xs text-amber-400 font-bold flex items-center gap-1 mt-0.5 truncate">
                              <Bookmark className="w-3 h-3 fill-amber-400 flex-shrink-0" />
                              <span>Saved snap by {lastMsg.savedByName || recipient.displayName.split(' ')[0]}</span>
                            </p>
                          ) : lastMsg.viewStatus === 'viewed' ? (
                            <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5 truncate">
                              <Square className="w-2.5 h-2.5 stroke-[2] flex-shrink-0" />
                              <span>Opened snap · {formatReceiptTime(lastMsg.viewedAt || lastMsg.createdAt)}</span>
                            </p>
                          ) : (
                            <p className="text-xs text-rose-400 font-semibold flex items-center gap-1 mt-0.5 truncate">
                              <Flame className="w-3 h-3 fill-rose-400 flex-shrink-0" />
                              <span>Delivered {lastMsg.type.toUpperCase()} Snap</span>
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-white/50 truncate mt-0.5">
                            {lastMsg ? (
                              lastMsg.type === 'text' ? (
                                lastMsg.content
                              ) : lastMsg.isSaved ? (
                                <span className="text-amber-400 font-medium flex items-center gap-1">
                                  <Bookmark className="w-2.5 h-2.5 fill-amber-400" />
                                  Saved snap
                                </span>
                              ) : lastMsg.viewStatus === 'viewed' ? (
                                <span className="text-white/40 flex items-center gap-1">
                                  <Square className="w-2.5 h-2.5 stroke-[2] fill-transparent inline" />
                                  Opened snap
                                </span>
                              ) : (
                                `[${lastMsg.type.toUpperCase()} Snap]`
                              )
                            ) : (
                              'Start chatting'
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-3">
                      <span className="text-[10px] text-white/40">
                        {lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {isUnopenedSnap && (
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-md shadow-yellow-400/50" />
                      )}
                      {isRepliedToMe && (
                        <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* 2. Individual Active Chat View */
        <div className="flex flex-col h-full bg-[#0a0a0f]">
          {/* Active Chat Header */}
          {(() => {
            const recipient = getRecipient(activeChat);
            const otherUid = recipient.uid;
            const otherIsTyping = Boolean(activeChat.typing && activeChat.typing[otherUid]);

            return (
              <div className="bg-[#121218] border-b border-white/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveChat(null)}
                    className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <img
                    src={
                      recipient.photoURL ||
                      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
                    }
                    alt={recipient.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />

                  <div>
                    <h3 className="font-bold text-sm text-white">{recipient.displayName}</h3>
                    <p className="text-xs text-white/40">
                      {otherIsTyping ? (
                        <span className="text-purple-400 font-semibold animate-pulse">Typing...</span>
                      ) : (
                        `@${recipient.username}`
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenCamera(recipient)}
                    className="w-9 h-9 rounded-full bg-yellow-400/20 text-yellow-300 hover:bg-yellow-400/30 flex items-center justify-center cursor-pointer transition-colors"
                    title="Send AR Snap"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-touch" style={{ touchAction: 'pan-y' }}>
            {messages.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-yellow-400/50" />
                <p className="text-xs">No messages yet. Send an ephemeral snap!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUser.uid;
                const isMediaSnap = msg.type === 'image' || msg.type === 'video';

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`group/row relative flex flex-col transition-all duration-300 ${
                      isMe ? 'items-end' : 'items-start'
                    } ${
                      highlightedMessageId === msg.id
                        ? 'p-1 rounded-3xl bg-yellow-400/20 ring-2 ring-yellow-400 scale-[1.02]'
                        : ''
                    }`}
                  >
                    {isMediaSnap ? (
                      /* Ephemeral Snap Message Bubble */
                      <div className="relative flex items-center gap-2 group/bubble">
                        {/* Quick Reply Button on Hover / Mobile Touch */}
                        <button
                          type="button"
                          onClick={() => handleStartReply(msg)}
                          className={`opacity-60 sm:opacity-0 sm:group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 transition-all p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white/80 hover:text-white cursor-pointer shadow-sm ${
                            isMe ? 'order-first' : 'order-last'
                          }`}
                          title="Reply to snap"
                          aria-label="Reply to snap"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>

                        <div
                          onClick={() => {
                            if (msg.viewStatus !== 'viewed' || msg.isSaved) {
                              setViewingSnap({
                                message: msg,
                                senderName: msg.senderName || (isMe ? 'Me' : recipient.displayName),
                              });
                            }
                          }}
                          className={`p-3.5 rounded-2xl flex items-center gap-3 transition-all ${
                            msg.isSaved
                              ? 'bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-amber-900/40 border border-amber-400/40 text-amber-100 cursor-pointer shadow-md shadow-amber-500/10 hover:scale-102 active:scale-98'
                              : msg.viewStatus === 'viewed'
                              ? 'bg-white/5 border border-white/10 text-white/40 cursor-default'
                              : isMe
                              ? 'bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/30 text-white cursor-default'
                              : 'bg-gradient-to-r from-red-600 to-rose-600 text-white cursor-pointer hover:scale-102 shadow-lg shadow-red-600/30 active:scale-98'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              msg.isSaved
                                ? 'bg-amber-400/20 text-amber-300'
                                : msg.viewStatus === 'viewed'
                                ? 'bg-white/5'
                                : 'bg-white/20'
                            }`}
                          >
                            {msg.isSaved ? (
                              <Bookmark className="w-5 h-5 fill-amber-400 text-amber-400" />
                            ) : msg.viewStatus === 'viewed' ? (
                              <Square className="w-4 h-4 stroke-[2.5]" />
                            ) : (
                              <Flame className="w-5 h-5 fill-current animate-pulse text-yellow-300" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              {msg.isSaved
                                ? `Saved ${msg.type.toUpperCase()} Snap`
                                : msg.viewStatus === 'viewed'
                                ? isMe
                                  ? 'Opened Snap'
                                  : 'Opened Snap (Expired)'
                                : isMe
                                ? `Delivered ${msg.type.toUpperCase()} Snap (${msg.duration || 10}s)`
                                : `New ${msg.type.toUpperCase()} Snap (${msg.duration || 10}s)`}
                            </p>
                            <p className="text-[10px] opacity-80 truncate">
                              {msg.isSaved
                                ? `Saved in chat by ${msg.savedByName || (isMe ? 'You' : 'Friend')} • Tap to replay`
                                : msg.viewStatus === 'viewed'
                                ? isMe
                                  ? `Opened by ${recipient.displayName} · ${formatReceiptTime(msg.viewedAt || msg.createdAt)}`
                                  : 'Purged from storage'
                                : isMe
                                ? `Waiting for ${recipient.displayName} to open`
                                : 'Tap to view before it vanishes'}
                            </p>
                          </div>

                          {/* Quick Download icon if snap is saved */}
                          {msg.isSaved && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadMedia(msg.content, msg.type);
                              }}
                              className="ml-auto p-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 transition-colors"
                              title="Download snap file"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Regular Text Message Bubble */
                      <div className="relative flex items-center gap-2 group/bubble max-w-[85%] sm:max-w-[75%]">
                        {/* Quick Reply Button on Hover / Mobile Touch */}
                        <button
                          type="button"
                          onClick={() => handleStartReply(msg)}
                          className={`opacity-60 sm:opacity-0 sm:group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 transition-all p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white/80 hover:text-white cursor-pointer shadow-sm ${
                            isMe ? 'order-first' : 'order-last'
                          }`}
                          title="Reply to message"
                          aria-label="Reply to message"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>

                        <div
                          onDoubleClick={() => handleStartReply(msg)}
                          className={`w-full px-4 py-2.5 rounded-2xl text-sm shadow-md transition-all select-text ${
                            isMe
                              ? 'bg-purple-600 text-white rounded-br-none'
                              : !isMe && msg.replyTo && msg.replyTo.senderId === currentUser.uid
                              ? 'bg-[#1e1b2e] border-l-4 border-yellow-400 text-white rounded-bl-none shadow-yellow-500/10'
                              : 'bg-white/10 text-white/90 rounded-bl-none'
                          }`}
                        >
                          {/* Replied to You notification badge on incoming message */}
                          {!isMe && msg.replyTo && msg.replyTo.senderId === currentUser.uid && (
                            <div className="flex items-center gap-1 text-[10px] text-yellow-300 font-extrabold mb-1.5">
                              <CornerUpLeft className="w-3 h-3 stroke-[3]" />
                              <span>Replied to your {msg.replyTo.type === 'text' ? 'message' : 'snap'}</span>
                            </div>
                          )}

                          {/* Quoted Parent Message (Clickable to jump) */}
                          {msg.replyTo && (
                            <div
                              onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                              className={`mb-2 px-3 py-1.5 rounded-xl text-xs border-l-2 cursor-pointer transition-all ${
                                isMe
                                  ? 'bg-purple-700/70 border-yellow-300 text-purple-100 hover:bg-purple-700'
                                  : 'bg-black/40 border-purple-400 text-white/90 hover:bg-black/60'
                              }`}
                              title="Click to jump to quoted message"
                            >
                              <div className="font-bold text-[10px] text-yellow-300 flex items-center gap-1">
                                <CornerUpLeft className="w-2.5 h-2.5" />
                                <span>
                                  {msg.replyTo.senderId === currentUser.uid
                                    ? 'You'
                                    : msg.replyTo.senderName || 'Friend'}
                                </span>
                              </div>
                              <p className="truncate text-[11px] opacity-85 mt-0.5">
                                {msg.replyTo.content}
                              </p>
                            </div>
                          )}

                          <p className="break-words leading-relaxed">{msg.content}</p>

                          {/* Timestamp and Read Status Receipt */}
                          <div className="flex items-center justify-end gap-1.5 mt-1 font-mono text-[9px]">
                            <span className="text-white/50">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              msg.viewStatus === 'viewed' ? (
                                <span
                                  className="inline-flex items-center gap-0.5 text-sky-300 font-semibold"
                                  title={`Seen ${msg.viewedAt ? new Date(msg.viewedAt).toLocaleTimeString() : ''}`}
                                >
                                  <CheckCheck className="w-3 h-3 stroke-[2.5]" />
                                  <span>Seen {formatReceiptTime(msg.viewedAt || msg.createdAt)}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-white/40" title="Delivered">
                                  <CheckCheck className="w-3 h-3 opacity-60" />
                                  <span>Delivered</span>
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Replying-To Active Quoted Preview Banner */}
          {replyingTo && (
            <div className="px-4 py-2 bg-[#181822] border-t border-white/10 flex items-center justify-between animate-in slide-in-from-bottom-2 z-20">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-1 h-8 rounded-full bg-purple-500 flex-shrink-0" />
                <div className="flex flex-col text-xs min-w-0">
                  <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                    <CornerUpLeft className="w-3.5 h-3.5" />
                    <span>
                      Replying to {replyingTo.senderName || (replyingTo.senderId === currentUser.uid ? 'Yourself' : 'Friend')}
                    </span>
                  </div>
                  <p className="text-white/60 truncate max-w-[260px] sm:max-w-md mt-0.5">
                    {replyingTo.type === 'text' ? replyingTo.content : `[${replyingTo.type.toUpperCase()} SNAP]`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
                title="Cancel reply"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-[#121218] border-t border-white/10 flex items-center gap-2 z-30 flex-shrink-0"
          >
            <button
              type="button"
              onClick={() => onOpenCamera(getRecipient(activeChat))}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-yellow-400 hover:text-yellow-300 cursor-pointer flex-shrink-0"
              title="Camera Snap"
            >
              <Camera className="w-5 h-5" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={replyingTo ? `Replying to ${replyingTo.senderName || 'message'}...` : 'Send a chat...'}
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-purple-500 transition-colors"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center justify-center text-white cursor-pointer flex-shrink-0 shadow transition-all active:scale-95"
            >
              <Send className="w-4 h-4 fill-white" />
            </button>
          </form>
        </div>
      )}

      {/* Ephemeral Snap Fullscreen Viewer */}
      {viewingSnap && activeChat && (
        <EphemeralViewerModal
          message={viewingSnap.message}
          chatId={activeChat.id}
          senderName={viewingSnap.senderName}
          currentUser={currentUser}
          onClose={() => setViewingSnap(null)}
        />
      )}

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#16161e] border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-yellow-400" />
                <span>Add Friend</span>
              </h3>
              <button
                onClick={() => {
                  setShowAddFriend(false);
                  setFriendAddStatus(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Share your own handle card */}
            <div className="mt-4 p-3.5 bg-yellow-400/10 border border-yellow-400/25 rounded-2xl flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Your Mosa Handle</p>
                <p className="text-sm font-black text-yellow-300 truncate">@{currentUser.username}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentUser.username);
                  setFriendAddStatus(`Copied @${currentUser.username} to clipboard! Share with your friend.`);
                  setTimeout(() => setFriendAddStatus(null), 3000);
                }}
                className="px-3 py-1.5 bg-yellow-400 text-black hover:bg-yellow-300 rounded-xl text-xs font-black transition-colors cursor-pointer flex-shrink-0 shadow"
              >
                Copy
              </button>
            </div>

            <form onSubmit={handleAddFriendSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-white/70 font-semibold mb-1 block">
                  Find Friend by Username or Email
                </label>
                <input
                  type="text"
                  value={friendUsernameInput}
                  onChange={(e) => setFriendUsernameInput(e.target.value)}
                  placeholder="e.g. friend_username or email"
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                />
              </div>

              {friendAddStatus && (
                <p className="text-xs text-yellow-400 font-medium">{friendAddStatus}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold rounded-xl shadow active:scale-98 transition-all cursor-pointer text-sm"
              >
                Add & Start Chatting
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
