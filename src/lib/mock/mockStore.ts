import { UserProfile, Story, Chat, Message } from '@/types';

// Default mock current user
export const DEFAULT_USER: UserProfile = {
  uid: 'user_maccarthy',
  username: 'maccarthy_qa',
  displayName: 'MacCarthy Collins Setor',
  email: 'maccarthy@ephemeral.social',
  photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  friends: ['user_elena', 'user_alex', 'user_sarah'],
  streak: 14,
  createdAt: Date.now() - 30 * 86400000,
};

export const DEMO_FRIENDS: Record<string, UserProfile> = {
  user_elena: {
    uid: 'user_elena',
    username: 'elena_v',
    displayName: 'Elena Vance',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    friends: ['user_maccarthy'],
    streak: 21,
    createdAt: Date.now() - 40 * 86400000,
  },
  user_alex: {
    uid: 'user_alex',
    username: 'alex_chen',
    displayName: 'Alex Chen',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    friends: ['user_maccarthy'],
    streak: 8,
    createdAt: Date.now() - 25 * 86400000,
  },
  user_sarah: {
    uid: 'user_sarah',
    username: 'sarah_k',
    displayName: 'Sarah Connor',
    photoURL: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=250&q=80',
    friends: ['user_maccarthy'],
    streak: 5,
    createdAt: Date.now() - 15 * 86400000,
  },
};

const INITIAL_STORIES: Story[] = [
  {
    id: 'story_1',
    authorId: 'user_elena',
    authorName: 'Elena Vance',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1080&q=80',
    type: 'image',
    caption: 'Tokyo Cyberpunk vibes at 2AM 🌃✨',
    createdAt: Date.now() - 3600000 * 2,
    expiresAt: Date.now() + 3600000 * 22,
    viewedBy: [],
  },
  {
    id: 'story_2',
    authorId: 'user_alex',
    authorName: 'Alex Chen',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1080&q=80',
    type: 'image',
    caption: 'Sunset hike above the clouds ⛰️🌅',
    createdAt: Date.now() - 3600000 * 6,
    expiresAt: Date.now() + 3600000 * 18,
    viewedBy: [],
  },
  {
    id: 'story_3',
    authorId: 'user_sarah',
    authorName: 'Sarah Connor',
    authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=250&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1080&q=80',
    type: 'image',
    caption: 'Studio session with the squad 🎧🎸',
    createdAt: Date.now() - 3600000 * 12,
    expiresAt: Date.now() + 3600000 * 12,
    viewedBy: [],
  },
];

const INITIAL_CHATS: Chat[] = [
  {
    id: 'chat_elena',
    participants: ['user_maccarthy', 'user_elena'],
    updatedAt: Date.now() - 1000 * 60 * 5,
    lastMessage: {
      content: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1080&q=80',
      type: 'image',
      senderId: 'user_elena',
      createdAt: Date.now() - 1000 * 60 * 5,
      viewStatus: 'delivered', // Unopened ephemeral snap!
    },
    typing: {},
  },
  {
    id: 'chat_alex',
    participants: ['user_maccarthy', 'user_alex'],
    updatedAt: Date.now() - 1000 * 60 * 30,
    lastMessage: {
      content: 'Hey MacCarthy! Did the WebGL 3D face landmarker pass QA on your device?',
      type: 'text',
      senderId: 'user_alex',
      createdAt: Date.now() - 1000 * 60 * 30,
      viewStatus: 'viewed',
    },
    typing: {},
  },
  {
    id: 'chat_sarah',
    participants: ['user_maccarthy', 'user_sarah'],
    updatedAt: Date.now() - 1000 * 60 * 120,
    lastMessage: {
      content: 'See you at the hackathon tomorrow! 🔥',
      type: 'text',
      senderId: 'user_sarah',
      createdAt: Date.now() - 1000 * 60 * 120,
      viewStatus: 'viewed',
    },
    typing: {},
  },
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  chat_elena: [
    {
      id: 'msg_e1',
      senderId: 'user_elena',
      type: 'text',
      content: 'Hey MacCarthy! Check out this new neon filter snap I made!',
      viewStatus: 'viewed',
      createdAt: Date.now() - 1000 * 60 * 15,
    },
    {
      id: 'msg_e2',
      senderId: 'user_elena',
      type: 'image',
      content: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1080&q=80',
      viewStatus: 'delivered',
      duration: 10,
      createdAt: Date.now() - 1000 * 60 * 5,
    },
  ],
  chat_alex: [
    {
      id: 'msg_a1',
      senderId: 'user_maccarthy',
      type: 'text',
      content: 'Hey Alex, testing the Vercel 4.5MB Direct-to-Storage bypass.',
      viewStatus: 'viewed',
      createdAt: Date.now() - 1000 * 60 * 45,
    },
    {
      id: 'msg_a2',
      senderId: 'user_alex',
      type: 'text',
      content: 'Hey MacCarthy! Did the WebGL 3D face landmarker pass QA on your device?',
      viewStatus: 'viewed',
      createdAt: Date.now() - 1000 * 60 * 30,
    },
  ],
  chat_sarah: [
    {
      id: 'msg_s1',
      senderId: 'user_sarah',
      type: 'text',
      content: 'See you at the hackathon tomorrow! 🔥',
      viewStatus: 'viewed',
      createdAt: Date.now() - 1000 * 60 * 120,
    },
  ],
};

class MockDatabase {
  private users: Record<string, UserProfile> = {
    [DEFAULT_USER.uid]: DEFAULT_USER,
    ...DEMO_FRIENDS,
  };
  private stories: Story[] = [...INITIAL_STORIES];
  private chats: Chat[] = [...INITIAL_CHATS];
  private messages: Record<string, Message[]> = { ...INITIAL_MESSAGES };
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedStories = localStorage.getItem('ephemeral_stories');
        const savedChats = localStorage.getItem('ephemeral_chats');
        const savedMessages = localStorage.getItem('ephemeral_messages');
        const savedUser = localStorage.getItem('ephemeral_current_user');

        if (savedStories) {
          const parsed = JSON.parse(savedStories);
          if (Array.isArray(parsed) && parsed.length > 0) this.stories = parsed;
        }
        if (savedChats) {
          const parsed = JSON.parse(savedChats);
          if (Array.isArray(parsed) && parsed.length > 0) this.chats = parsed;
        }
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          if (parsed && Object.keys(parsed).length > 0) {
            this.messages = { ...INITIAL_MESSAGES, ...parsed };
          }
        }
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.uid) {
            this.users[DEFAULT_USER.uid] = {
              ...DEFAULT_USER,
              ...parsed,
              friends: (parsed.friends && parsed.friends.length > 0)
                ? parsed.friends
                : ['user_elena', 'user_alex', 'user_sarah'],
            };
          }
        }
      } catch (err) {
        console.warn('Failed to load mock state from localStorage', err);
      }
    }
  }

  private save() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ephemeral_stories', JSON.stringify(this.stories));
        localStorage.setItem('ephemeral_chats', JSON.stringify(this.chats));
        localStorage.setItem('ephemeral_messages', JSON.stringify(this.messages));
        localStorage.setItem('ephemeral_current_user', JSON.stringify(this.users[DEFAULT_USER.uid]));
      } catch (err) {
        console.warn('Failed to persist mock state', err);
      }
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((callback) => {
      try {
        callback();
      } catch (e) {
        console.error(e);
      }
    });
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getCurrentUser(): UserProfile {
    return this.users[DEFAULT_USER.uid] || DEFAULT_USER;
  }

  updateCurrentUser(updates: Partial<UserProfile>): UserProfile {
    const updated = { ...this.getCurrentUser(), ...updates };
    this.users[DEFAULT_USER.uid] = updated;
    if (updates.uid) {
      this.users[updates.uid] = updated;
    }
    this.save();
    return updated;
  }

  getUser(uid: string): UserProfile | undefined {
    return this.users[uid] || DEMO_FRIENDS[uid];
  }

  getFriends(): UserProfile[] {
    const user = this.getCurrentUser();
    const friendList = (user.friends || []).map((fid) => this.users[fid] || DEMO_FRIENDS[fid]).filter(Boolean);
    if (friendList.length > 0) return friendList;
    // Always guarantee seed friends so the UI is never empty
    return Object.values(DEMO_FRIENDS).filter((f) => f.uid !== user.uid);
  }

  addFriend(usernameOrUid: string): UserProfile | null {
    const normalized = usernameOrUid.toLowerCase().trim();
    const found = Object.values(this.users).find(
      (u) => u.username.toLowerCase() === normalized || u.uid.toLowerCase() === normalized
    ) || Object.values(DEMO_FRIENDS).find(
      (u) => u.username.toLowerCase() === normalized || u.uid.toLowerCase() === normalized
    );

    if (!found) return null;
    const current = this.getCurrentUser();
    if (!current.friends.includes(found.uid) && found.uid !== current.uid) {
      current.friends.push(found.uid);
      this.updateCurrentUser({ friends: [...current.friends] });

      // Create a chat if one doesn't exist
      const existingChat = this.chats.find(
        (c) => c.participants.includes(current.uid) && c.participants.includes(found.uid)
      );
      if (!existingChat) {
        const newChat: Chat = {
          id: `chat_${found.uid.replace('user_', '')}`,
          participants: [current.uid, found.uid],
          updatedAt: Date.now(),
          typing: {},
        };
        this.chats.unshift(newChat);
        this.messages[newChat.id] = [];
      }
      this.save();
    }
    return found;
  }

  // Stories (Firestore TTL simulation)
  getStories(): Story[] {
    const now = Date.now();
    const active = this.stories.filter((s) => s.expiresAt > now);
    if (active.length > 0) return active;
    return INITIAL_STORIES;
  }

  addStory(storyData: Omit<Story, 'id' | 'createdAt' | 'expiresAt'>): Story {
    const now = Date.now();
    const newStory: Story = {
      ...storyData,
      id: `story_${now}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      expiresAt: now + 86400000, // 24 hours TTL
      viewedBy: [],
    };
    this.stories.unshift(newStory);
    this.save();
    return newStory;
  }

  deleteStory(storyId: string) {
    this.stories = this.stories.filter((s) => s.id !== storyId);
    this.save();
  }

  markStoryViewed(storyId: string, uid: string) {
    const story = this.stories.find((s) => s.id === storyId);
    if (story && !story.viewedBy?.includes(uid)) {
      story.viewedBy = [...(story.viewedBy || []), uid];
      this.save();
    }
  }

  // Chats & Ephemeral Snaps
  getChats(): Chat[] {
    const currentUid = this.getCurrentUser().uid;

    // Guarantee that baseline demo chats always exist in this.chats
    for (const initChat of INITIAL_CHATS) {
      const friendUid = initChat.participants.find((p) => p !== 'user_maccarthy') || 'user_elena';
      const exists = this.chats.some(
        (c) =>
          c.id === initChat.id ||
          (c.participants.includes(currentUid) && c.participants.includes(friendUid))
      );
      if (!exists) {
        this.chats.push({
          ...initChat,
          participants: [currentUid, friendUid],
        });
      }
    }

    const mappedChats = this.chats.map((c) => {
      if (c.participants.includes(currentUid)) return c;
      const other = c.participants.find((p) => p !== 'user_maccarthy') || c.participants[0] || 'user_elena';
      return {
        ...c,
        participants: [currentUid, other],
      };
    });

    return mappedChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  getMessages(chatId: string): Message[] {
    // 1. Direct exact key match
    if (this.messages[chatId] && this.messages[chatId].length > 0) {
      return this.messages[chatId];
    }

    // 2. Normalize key without prefix (e.g. 'chat_elena' -> 'elena', 'chat_user_elena' -> 'elena')
    const cleanTarget = chatId.replace('chat_', '').replace('user_', '').toLowerCase();
    for (const key of Object.keys(this.messages)) {
      const cleanKey = key.replace('chat_', '').replace('user_', '').toLowerCase();
      if (cleanKey === cleanTarget || chatId.includes(cleanKey) || key.includes(cleanTarget)) {
        if (this.messages[key] && this.messages[key].length > 0) {
          return this.messages[key];
        }
      }
    }

    // 3. Fallback to INITIAL_MESSAGES
    for (const key of Object.keys(INITIAL_MESSAGES)) {
      const cleanKey = key.replace('chat_', '').replace('user_', '').toLowerCase();
      if (cleanKey === cleanTarget || chatId.includes(cleanKey) || key.includes(cleanTarget)) {
        return INITIAL_MESSAGES[key];
      }
    }

    return this.messages[chatId] || [];
  }

  sendMessage(
    chatId: string,
    message: Omit<Message, 'id' | 'createdAt' | 'viewStatus'> & { duration?: number }
  ): Message {
    const current = this.getCurrentUser();
    const newMsg: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      senderName: message.senderName || current.displayName,
      createdAt: Date.now(),
      viewStatus: 'delivered',
    };

    // Determine target bucket key so thread continuity is preserved
    let targetKey = chatId;
    if (!this.messages[targetKey]) {
      const cleanTarget = chatId.replace('chat_', '').replace('user_', '').toLowerCase();
      for (const key of Object.keys(this.messages)) {
        const cleanKey = key.replace('chat_', '').replace('user_', '').toLowerCase();
        if (cleanKey === cleanTarget || chatId.includes(cleanKey) || key.includes(cleanTarget)) {
          targetKey = key;
          break;
        }
      }
      if (!this.messages[targetKey]) {
        // Initialize with any existing initial messages
        const initial = this.getMessages(chatId);
        this.messages[targetKey] = [...initial];
      }
    }

    this.messages[targetKey].push(newMsg);
    if (targetKey !== chatId) {
      this.messages[chatId] = this.messages[targetKey];
    }

    // Update or create chat in this.chats
    let chat = this.chats.find(
      (c) =>
        c.id === chatId ||
        c.id === targetKey ||
        c.id.replace('chat_', '').replace('user_', '') === chatId.replace('chat_', '').replace('user_', '')
    );

    if (!chat) {
      chat = {
        id: chatId,
        participants: [current.uid, chatId.replace('chat_', '')],
        updatedAt: Date.now(),
        typing: {},
      };
      this.chats.unshift(chat);
    }

    chat.updatedAt = Date.now();
    chat.lastMessage = {
      content: newMsg.type === 'text' ? newMsg.content : `[${newMsg.type.toUpperCase()} SNAP]`,
      type: newMsg.type,
      senderId: newMsg.senderId,
      createdAt: newMsg.createdAt,
      viewStatus: newMsg.viewStatus,
    };

    this.save();
    return newMsg;
  }

  markSnapViewed(chatId: string, messageId: string) {
    const list = this.getMessages(chatId);
    if (list) {
      const msg = list.find((m) => m.id === messageId);
      if (msg && msg.viewStatus !== 'viewed') {
        msg.viewStatus = 'viewed';
        msg.viewedAt = Date.now();

        // Update last message status if this was the last message
        const chat = this.chats.find((c) => c.id === chatId);
        if (chat && chat.lastMessage) {
          chat.lastMessage.viewStatus = 'viewed';
        }
        this.save();
      }
    }
  }

  setTyping(chatId: string, uid: string, isTyping: boolean) {
    const chat = this.chats.find((c) => c.id === chatId);
    if (chat) {
      if (!chat.typing) chat.typing = {};
      chat.typing[uid] = isTyping;
      this.notify();
    }
  }

  // Clear data / reset for QA testing
  resetTestData() {
    this.stories = [...INITIAL_STORIES];
    this.chats = [...INITIAL_CHATS];
    this.messages = { ...INITIAL_MESSAGES };
    this.users = {
      [DEFAULT_USER.uid]: DEFAULT_USER,
      ...DEMO_FRIENDS,
    };
    this.save();
  }
}

export const mockStore = new MockDatabase();
