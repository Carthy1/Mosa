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
  getAllUsers,
  subscribeAllUsers,
  formatChatTime,
  formatReceiptTime,
  toTimestampMillis,
} from '@/lib/firebase/firestore';
import { DEMO_FRIENDS, mockStore } from '@/lib/mock/mockStore';
import { EphemeralViewerModal } from '../snap/EphemeralViewerModal';
import { SnapPreviewModal } from '../camera/SnapPreviewModal';
import { compressImage } from '@/lib/firebase/storage';
import {
  getNotificationPermission,
  requestNotificationPermission,
  playNotificationSound,
  triggerHaptic,
} from '@/lib/notifications';
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
  Image as ImageIcon,
  Bell,
  BellRing,
} from 'lucide-react';

interface ChatPaneProps {
  currentUser: UserProfile;
  friends: UserProfile[];
  onOpenCamera: (targetUser?: UserProfile) => void;
  onOpenAuth?: () => void;
  onActiveChatChange?: (isActive: boolean, activeChatId?: string | null) => void;
  targetChatIdToOpen?: string | null;
  onTargetChatOpened?: () => void;
}

export function ChatPane({
  currentUser,
  friends,
  onOpenCamera,
  onOpenAuth,
  onActiveChatChange,
  targetChatIdToOpen,
  onTargetChatOpened,
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
  const [communityUsers, setCommunityUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [chatMediaToPreview, setChatMediaToPreview] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [showNotifBanner, setShowNotifBanner] = useState(true);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      setNotifFeedback('Notifications enabled! Chime alert active.');
      setTimeout(() => setNotifFeedback(null), 3500);
    }
  };

  const handleTestNotification = () => {
    playNotificationSound();
    triggerHaptic();
    setNotifFeedback('Notification sound chime played!');
    setTimeout(() => setNotifFeedback(null), 2500);
  };

  // Open chat targeted from notification tap
  useEffect(() => {
    if (!targetChatIdToOpen) return;
    const found = chats.find(
      (c) => c.id === targetChatIdToOpen || c.participants.includes(targetChatIdToOpen)
    );
    if (found) {
      setActiveChat(found);
      onTargetChatOpened?.();
    }
  }, [targetChatIdToOpen, chats, onTargetChatOpened]);

  useEffect(() => {
    if (!showAddFriend) return;
    setLoadingUsers(true);
    const unsubscribe = subscribeAllUsers(currentUser.uid, (users) => {
      setCommunityUsers(users);
      setLoadingUsers(false);
    });
    return () => unsubscribe();
  }, [showAddFriend, currentUser.uid]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    if (isVideo) {
      const url = URL.createObjectURL(file);
      setChatMediaToPreview({ url, type: 'video' });
    } else {
      try {
        const compressed = await compressImage(file);
        const url = URL.createObjectURL(compressed);
        setChatMediaToPreview({ url, type: 'image' });
      } catch {
        const url = URL.createObjectURL(file);
        setChatMediaToPreview({ url, type: 'image' });
      }
    }
    e.target.value = '';
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

  // Notify parent container when inside a conversation with activeChat id
  useEffect(() => {
    onActiveChatChange?.(Boolean(activeChat), activeChat?.id || null);
  }, [activeChat, onActiveChatChange]);

  // Global Escape key listener to leave chat or close modal immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddFriend) {
          setShowAddFriend(false);
          setFriendAddStatus(null);
        } else if (activeChat) {
          setActiveChat(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChat, showAddFriend]);

  // Subscribe to real-time chat list
  useEffect(() => {
    const unsubscribe = subscribeChats(currentUser.uid, (updatedChats) => {
      setChats(updatedChats);
    });
    return () => unsubscribe();
  }, [currentUser.uid]);

  // Subscribe to active chat messages & only mark incoming as viewed if there are unread text messages
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeMessages(activeChat.id, (msgs) => {
      setMessages(msgs);
      const hasUnreadIncoming = msgs.some(
        (m) => m.senderId !== currentUser.uid && m.viewStatus === 'delivered' && m.type === 'text'
      );
      if (hasUnreadIncoming) {
        markChatMessagesAsRead(activeChat.id, currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, [activeChat?.id, currentUser.uid]);

  // Auto-scroll chat container to bottom without scrolling window (guarantees header remains visible on iOS)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // When activeChat opens or changes, reset window scroll and ensure container is at bottom
  useEffect(() => {
    if (activeChat) {
      window.scrollTo(0, 0);
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  }, [activeChat]);

  // Get recipient profile for a chat
  const getRecipient = (chat: Chat): UserProfile => {
    const otherUid = chat.participants.find((id) => id !== currentUser.uid) || chat.participants[0] || 'unknown';

    // 1. Check if recipient profile exists on chat document
    const details = chat.participantProfiles?.[otherUid] || chat.participantDetails?.[otherUid];
    if (details) {
      return {
        uid: otherUid,
        displayName: details.displayName || (details.username ? `@${details.username}` : 'User'),
        username: details.username || otherUid.toLowerCase(),
        photoURL: details.photoURL || undefined,
        friends: [],
        createdAt: Date.now(),
      };
    }

    // 2. Check in friends array
    const friend = friends.find((f) => f.uid === otherUid);
    if (friend) return friend;

    // 3. Check in communityUsers
    const commUser = communityUsers.find((u) => u.uid === otherUid);
    if (commUser) return commUser;

    // 4. Direct check in DEMO_FRIENDS
    if (DEMO_FRIENDS[otherUid]) return DEMO_FRIENDS[otherUid];

    return {
      uid: otherUid,
      username: otherUid.replace('user_', ''),
      displayName: otherUid.replace('user_', ''),
      photoURL: undefined,
      friends: [],
      createdAt: Date.now(),
    };
  };

  // Deduplicate chats by recipient UID to ensure clean, singular threads with zero duplicates
  const displayChats = React.useMemo(() => {
    const map = new Map<string, Chat>();
    for (const chat of chats) {
      const recipient = getRecipient(chat);
      // Skip if recipient is currentUser (self-chat artifact)
      if (recipient.uid === currentUser.uid) continue;

      const existing = map.get(recipient.uid);
      if (!existing) {
        map.set(recipient.uid, chat);
      } else {
        const existingTime = toTimestampMillis(existing.updatedAt || existing.lastMessage?.createdAt);
        const currentTime = toTimestampMillis(chat.updatedAt || chat.lastMessage?.createdAt);
        if (currentTime > existingTime) {
          map.set(recipient.uid, chat);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const timeA = toTimestampMillis(a.updatedAt || a.lastMessage?.createdAt);
      const timeB = toTimestampMillis(b.updatedAt || b.lastMessage?.createdAt);
      return timeB - timeA;
    });
  }, [chats, currentUser.uid, friends, communityUsers]);

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

  const handleConnectWithUser = async (targetUsernameOrUid: string) => {
    const clean = targetUsernameOrUid.trim().toLowerCase().replace('@', '');
    if (!clean) return;

    if (
      clean === currentUser.username.toLowerCase() ||
      clean === currentUser.uid.toLowerCase() ||
      (currentUser.email && clean === currentUser.email.toLowerCase())
    ) {
      setFriendAddStatus("That's your own account! Share your handle with your friend or add them using their username.");
      return;
    }

    setFriendAddStatus('Connecting...');
    const result = await addFriend(clean, currentUser.uid);
    if (result) {
      setFriendAddStatus(`Connected with @${result.username}! Opening conversation...`);
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
      }, 600);
    } else {
      setFriendAddStatus(`User not found. Try their exact username, or select from the suggested friends below.`);
    }
  };

  const handleAddFriendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendUsernameInput.trim()) return;
    handleConnectWithUser(friendUsernameInput);
  };

  return (
    <div className="w-full h-full bg-[#0d0d12] text-white flex flex-col overflow-hidden">
      {/* 1. Main Chat List View */}
      {!activeChat ? (
        <div className="flex flex-col h-full overflow-y-auto pb-36 scroll-touch" style={{ touchAction: 'pan-y' }}>
          {/* Header */}
          <div
            className="sticky top-0 z-20 bg-[#0d0d12]/90 backdrop-blur-xl border-b border-white/10 px-5 pb-4 flex items-center justify-between"
            style={{ paddingTop: 'max(2.75rem, calc(env(safe-area-inset-top, 24px) + 0.75rem))' }}
          >
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
              {/* Notification Control & Audio Chime Test */}
              <button
                type="button"
                onClick={
                  notifPermission === 'granted'
                    ? handleTestNotification
                    : handleEnableNotifications
                }
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer relative ${
                  notifPermission === 'granted'
                    ? 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30 hover:bg-yellow-400/25'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                }`}
                title={
                  notifPermission === 'granted'
                    ? 'Notifications active (tap to test chime & haptics)'
                    : 'Turn on message notifications'
                }
                aria-label="Notification settings"
              >
                {notifPermission === 'granted' ? (
                  <BellRing className="w-4 h-4 text-yellow-300" />
                ) : (
                  <Bell className="w-4 h-4 text-white/70" />
                )}
                {notifPermission === 'granted' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 border border-black" />
                )}
              </button>

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

          {/* Notification Permission Prompt Banner (for users who haven't granted permission yet) */}
          {notifPermission === 'default' && showNotifBanner && (
            <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-purple-900/60 border border-purple-500/30 shadow-xl flex items-center justify-between gap-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center flex-shrink-0 border border-purple-500/30">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Get Instant Notifications</p>
                  <p className="text-[11px] text-white/60">Get instant sound & alerts when friends snap or chat</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs rounded-xl shadow active:scale-95 transition-all cursor-pointer"
                >
                  Turn On
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotifBanner(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Dismiss banner"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* User Feedback Toast for Chime / Settings */}
          {notifFeedback && (
            <div className="mx-4 mt-2 px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{notifFeedback}</span>
            </div>
          )}

          {/* Quick Start Snapping Carousel */}
          <div className="p-4 border-b border-white/5 bg-gradient-to-r from-purple-950/20 to-transparent">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
                Quick Snap
              </span>
              <button
                onClick={() => onOpenCamera()}
                className="text-xs text-yellow-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Open Camera
              </button>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 scroll-touch-x" style={{ touchAction: 'pan-x' }}>
              {friends.length === 0 ? (
                <div
                  onClick={() => setShowAddFriend(true)}
                  className="flex items-center gap-2 py-2 px-3 rounded-2xl bg-white/5 border border-dashed border-white/15 text-white/50 hover:text-white hover:bg-white/10 cursor-pointer text-xs transition-colors"
                >
                  <UserPlus className="w-4 h-4 text-yellow-400" />
                  <span>Add friends to send quick snaps</span>
                </div>
              ) : (
                friends.map((friend) => (
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
                ))
              )}
            </div>
          </div>

          {/* Conversations Thread List */}
          <div className="divide-y divide-white/5 flex-1 pb-16">
            {displayChats.length === 0 ? (
              <div className="p-8 text-center text-white/40">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Add a friend or send a snap to start chatting!</p>
              </div>
            ) : (
              displayChats.map((chat) => {
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
                        {recipient.photoURL ? (
                          <img
                            src={recipient.photoURL}
                            alt={recipient.displayName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center font-black text-white text-base shadow flex-shrink-0 border border-white/20">
                            {(recipient.displayName || recipient.username || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
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
                        ) : isRepliedToMe && lastMsg ? (
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
                        {lastMsg ? formatChatTime(lastMsg.createdAt) : ''}
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
              <div
                className="bg-[#121218] border-b border-white/10 px-3.5 sm:px-4 pb-3 flex items-center justify-between flex-shrink-0 z-30 shadow-md"
                style={{ paddingTop: 'max(3.25rem, calc(env(safe-area-inset-top, 24px) + 0.75rem))' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* High visibility Back to Chats button */}
                  <button
                    type="button"
                    onClick={() => setActiveChat(null)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs border border-white/20 cursor-pointer flex-shrink-0 transition-all shadow-sm"
                    title="Leave chat and return to chats list"
                    aria-label="Back to chats"
                  >
                    <ArrowLeft className="w-4 h-4 stroke-[3]" />
                    <span>Chats</span>
                  </button>

                  {recipient.photoURL ? (
                    <img
                      src={recipient.photoURL}
                      alt={recipient.displayName}
                      className="w-9 h-9 rounded-full object-cover border border-white/20 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center font-bold text-white text-xs shadow flex-shrink-0 border border-white/20">
                      {(recipient.displayName || recipient.username || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-white truncate">{recipient.displayName}</h3>
                    <p className="text-xs text-white/40 truncate">
                      {otherIsTyping ? (
                        <span className="text-purple-400 font-semibold animate-pulse">Typing...</span>
                      ) : (
                        `@${recipient.username}`
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenCamera(recipient)}
                    className="w-9 h-9 rounded-full bg-yellow-400/20 text-yellow-300 hover:bg-yellow-400/30 flex items-center justify-center cursor-pointer transition-colors shadow"
                    title="Send AR Snap"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChat(null)}
                    className="px-3.5 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 active:scale-95 text-red-200 hover:text-white text-xs font-bold transition-colors cursor-pointer border border-red-500/30 shadow-sm"
                    title="Leave conversation"
                  >
                    Leave
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Messages Feed */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 scroll-touch"
            style={{ touchAction: 'pan-y' }}
          >
            {messages.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-yellow-400/50" />
                <p className="text-xs">No messages yet. Send an ephemeral snap!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUser.uid;
                const isMediaSnap = msg.type === 'image' || msg.type === 'video';
                const chatRecipient = getRecipient(activeChat);
                const recipientDisplayName = chatRecipient?.displayName || 'Friend';

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
                                senderName: msg.senderName || (isMe ? 'Me' : recipientDisplayName),
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
                                  ? `Opened by ${recipientDisplayName} · ${formatReceiptTime(msg.viewedAt || msg.createdAt)}`
                                  : 'Purged from storage'
                                : isMe
                                ? `Waiting for ${recipientDisplayName} to open`
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
                              {formatChatTime(msg.createdAt)}
                            </span>
                            {isMe && (
                              msg.viewStatus === 'viewed' ? (
                                <span
                                  className="inline-flex items-center gap-0.5 text-sky-300 font-semibold"
                                  title={`Seen ${msg.viewedAt ? formatChatTime(msg.viewedAt) : ''}`}
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
            className="p-3 bg-[#121218] border-t border-white/10 flex items-center gap-2 z-30 flex-shrink-0 shadow-2xl"
            style={{
              paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 20px) + 0.75rem))',
            }}
          >
            {/* Fail-safe Back Button at bottom bar: always visible on mobile, right next to camera */}
            <button
              type="button"
              onClick={() => setActiveChat(null)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white cursor-pointer flex-shrink-0 border border-white/15 shadow-sm"
              title="Leave chat / Back to chats list"
              aria-label="Back to chats"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={() => onOpenCamera(getRecipient(activeChat))}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-yellow-400 hover:text-yellow-300 cursor-pointer flex-shrink-0 transition-colors"
              title="Camera Snap"
            >
              <Camera className="w-5 h-5" />
            </button>

            <label
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-purple-400 hover:text-purple-300 cursor-pointer flex-shrink-0 transition-colors"
              title="Upload photo or video snap"
            >
              <ImageIcon className="w-4 h-4" />
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleChatFileUpload}
                className="hidden"
              />
            </label>

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

      {/* Direct Snap Preview & Editing Modal for Chat Attachments */}
      {chatMediaToPreview && activeChat && (
        <SnapPreviewModal
          mediaUrl={chatMediaToPreview.url}
          mediaType={chatMediaToPreview.type}
          currentUser={currentUser}
          friends={friends}
          defaultRecipient={getRecipient(activeChat)}
          onClose={() => setChatMediaToPreview(null)}
          onSendComplete={() => setChatMediaToPreview(null)}
        />
      )}

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddFriend(false);
              setFriendAddStatus(null);
            }
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#16161e] border border-white/15 rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col cursor-default"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-yellow-400" />
                <span>Add Friend</span>
              </h3>
              <button
                onClick={() => {
                  setShowAddFriend(false);
                  setFriendAddStatus(null);
                }}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white cursor-pointer active:scale-90 transition-transform"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Share your own handle card */}
            <div className="mt-3 p-3 bg-yellow-400/10 border border-yellow-400/25 rounded-2xl flex items-center justify-between flex-shrink-0">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Your Mosa Handle</p>
                <p className="text-sm font-black text-yellow-300 truncate">@{currentUser.username}</p>
                <p className="text-[11px] text-white/60 truncate">{currentUser.displayName}</p>
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

            <form onSubmit={handleAddFriendSubmit} className="mt-3 space-y-3 flex-shrink-0">
              <div>
                <label className="text-xs text-white/70 font-semibold mb-1 block">
                  Find Friend by Username, Name, or Email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={friendUsernameInput}
                    onChange={(e) => setFriendUsernameInput(e.target.value)}
                    placeholder="e.g. friend_username or name"
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                  />
                  <Search className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                </div>
              </div>

              {friendAddStatus && (
                <div className="p-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
                  <p className="text-xs text-yellow-300 font-medium">{friendAddStatus}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!friendUsernameInput.trim()}
                className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-black font-extrabold rounded-xl shadow active:scale-98 transition-all cursor-pointer text-sm"
              >
                Search & Add
              </button>
            </form>

            {/* Filtered Suggested Users List */}
            {(() => {
              const q = friendUsernameInput.toLowerCase().trim().replace('@', '');
              const filteredList = communityUsers.filter((u) => {
                if (!q) return true;
                return (
                  u.username.toLowerCase().includes(q) ||
                  u.displayName.toLowerCase().includes(q) ||
                  (u.email && u.email.toLowerCase().includes(q))
                );
              });

              return (
                <div className="mt-3 border-t border-white/10 pt-3 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      Suggested Friends
                    </span>
                    {loadingUsers && (
                      <span className="text-[10px] text-white/40 animate-pulse">Loading...</span>
                    )}
                  </div>

                  <div className="overflow-y-auto space-y-2 max-h-44 pr-1 scroll-touch">
                    {filteredList.length === 0 ? (
                      friendUsernameInput.trim() ? (
                        <div className="p-2.5 bg-gradient-to-r from-purple-900/40 to-fuchsia-900/30 border border-purple-500/40 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-black text-xs text-white flex-shrink-0 shadow">
                              {friendUsernameInput.replace('@', '').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{friendUsernameInput.replace('@', '')}</p>
                              <p className="text-[11px] text-yellow-300 truncate">@{friendUsernameInput.toLowerCase().trim().replace('@', '')}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleConnectWithUser(friendUsernameInput)}
                            className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl text-xs font-black transition-all shadow active:scale-95 flex-shrink-0 cursor-pointer"
                          >
                            + Add & Chat
                          </button>
                        </div>
                      ) : (
                        <div className="py-3 text-center text-xs text-white/40">
                          {loadingUsers ? 'Searching community...' : 'No users matching your search.'}
                        </div>
                      )
                    ) : (
                      filteredList.map((u) => {
                        const isAlreadyFriend = (currentUser.friends || []).includes(u.uid);
                        return (
                          <div
                            key={u.uid}
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={u.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                                alt={u.displayName}
                                className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{u.displayName}</p>
                                <p className="text-[11px] text-yellow-300/80 truncate">@{u.username}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleConnectWithUser(u.username)}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow active:scale-95 flex-shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                              {isAlreadyFriend ? 'Chat' : '+ Add'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Bottom Done / Close Button */}
            <div className="mt-3 pt-3 border-t border-white/10 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowAddFriend(false);
                  setFriendAddStatus(null);
                }}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-98 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Close Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
