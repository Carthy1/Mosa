import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { mockStore } from '../mock/mockStore';
import { UserProfile, Story, Chat, Message, SnapViewStatus } from '@/types';

// ========================
// USERS COLLECTION
// ========================

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isFirebaseConfigured && db) {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        return userSnap.data() as UserProfile;
      }
    } catch (e: any) {
      console.warn('Firestore getUserProfile notice (using fallback):', e?.message || e);
    }
  }
  return mockStore.getUser(uid) || null;
}

export async function saveUserProfile(user: UserProfile): Promise<void> {
  mockStore.updateCurrentUser(user);

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'users', user.uid), user, { merge: true });
    } catch (e: any) {
      console.warn('Firestore saveUserProfile notice (saved locally):', e?.message || e);
    }
  }
}

export async function addFriend(friendUsernameOrUid: string): Promise<UserProfile | null> {
  // Check local mock store first so demo friends (elena_v, alex_chen, sarah_k) always resolve
  const localFriend = mockStore.addFriend(friendUsernameOrUid);
  if (localFriend) return localFriend;

  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '==', friendUsernameOrUid.toLowerCase().trim())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const friendData = snap.docs[0].data() as UserProfile;
        return friendData;
      }
    } catch (e) {
      console.warn('Firestore addFriend query error:', e);
    }
  }
  return null;
}

// ========================
// STORIES COLLECTION (24h TTL)
// ========================

/**
 * Publishes a 24-hour ephemeral story.
 * Requires Firestore TTL policy on the 'expiresAt' field.
 */
export async function publishStory(
  author: UserProfile,
  mediaUrl: string,
  type: 'image' | 'video' = 'image',
  caption?: string
): Promise<Story> {
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // Exactly 24 hours

  const storyData: Omit<Story, 'id'> = {
    authorId: author.uid,
    authorName: author.displayName || author.username,
    authorAvatar: author.photoURL,
    mediaUrl,
    type,
    caption,
    createdAt: now,
    expiresAt,
    viewedBy: [],
  };

  // 1. Immediately store into local mock store so story appears instantly in Stories pane!
  const localStory = mockStore.addStory(storyData);

  // 2. Synchronously or asynchronously attempt Firestore push
  if (isFirebaseConfigured && db) {
    try {
      const docRef = await addDoc(collection(db, 'stories'), {
        ...storyData,
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(expiresAt),
      });
      return { id: docRef.id, ...storyData };
    } catch (e: any) {
      console.warn('Firestore publishStory notice (saved locally in mockStore):', e?.message || e);
      return localStory;
    }
  }

  return localStory;
}

/**
 * Real-time listener for stories.
 * Filters out expired stories (client-side guarantee + Firestore query).
 */
export function subscribeStories(callback: (stories: Story[]) => void): () => void {
  // 1. Immediately provide local stories so screen is never blank
  callback(mockStore.getStories());

  // 2. Always subscribe to mockStore for real-time reactivity
  const unsubMock = mockStore.subscribe(() => {
    callback(mockStore.getStories());
  });

  let unsubFirestore: (() => void) | null = null;

  // 3. Connect to live Firestore stories collection if configured
  if (isFirebaseConfigured && db) {
    try {
      const q = collection(db, 'stories');

      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const now = Date.now();
          const liveStories: Story[] = snapshot.docs
            .map((docSnap) => {
              const data = docSnap.data();
              return {
                id: docSnap.id,
                authorId: data.authorId,
                authorName: data.authorName,
                authorAvatar: data.authorAvatar,
                mediaUrl: data.mediaUrl,
                type: data.type || 'image',
                caption: data.caption,
                createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
                expiresAt: data.expiresAt?.toMillis ? data.expiresAt.toMillis() : Date.now() + 86400000,
                viewedBy: data.viewedBy || [],
              };
            })
            .filter((s) => s.expiresAt > now)
            .sort((a, b) => b.createdAt - a.createdAt);

          if (liveStories.length > 0) {
            callback(liveStories);
          } else {
            callback(mockStore.getStories());
          }
        },
        (err) => {
          console.warn('Firestore stories notice (using resilient mockStore):', err?.message || err);
          callback(mockStore.getStories());
        }
      );
    } catch (err) {
      console.warn('Firestore stories setup error:', err);
    }
  }

  return () => {
    unsubMock();
    if (unsubFirestore) {
      try {
        unsubFirestore();
      } catch (e) {}
    }
  };
}

export async function deleteStory(storyId: string): Promise<void> {
  mockStore.deleteStory(storyId);
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (e: any) {
      console.warn('Firestore deleteStory notice:', e?.message || e);
    }
  }
}

// ========================
// CHATS & MESSAGES SUBCOLLECTION
// ========================

export function subscribeChats(
  currentUid: string,
  callback: (chats: Chat[]) => void
): () => void {
  // 1. Immediately provide local/demo chats so screen is never blank
  callback(mockStore.getChats());

  // 2. Always subscribe to mockStore for real-time reactivity
  const unsubMock = mockStore.subscribe(() => {
    callback(mockStore.getChats());
  });

  let unsubFirestore: (() => void) | null = null;

  // 3. Connect to live Firestore if configured
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUid)
      );

      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const liveChats: Chat[] = snapshot.docs
              .map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Chat, 'id'>),
              }))
              .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

            callback(liveChats);
          } else {
            callback(mockStore.getChats());
          }
        },
        (err) => {
          console.warn('Firestore chats subscription notice (using resilient mockStore):', err?.message || err);
          callback(mockStore.getChats());
        }
      );
    } catch (err) {
      console.warn('Firestore chats query error:', err);
    }
  }

  return () => {
    unsubMock();
    if (unsubFirestore) {
      try {
        unsubFirestore();
      } catch (e) {}
    }
  };
}

export function subscribeMessages(
  chatId: string,
  callback: (messages: Message[]) => void
): () => void {
  // 1. Immediately provide local/demo messages
  callback(mockStore.getMessages(chatId));

  // 2. Always subscribe to mockStore for real-time updates
  const unsubMock = mockStore.subscribe(() => {
    callback(mockStore.getMessages(chatId));
  });

  let unsubFirestore: (() => void) | null = null;

  // 3. Connect to live Firestore messages subcollection
  if (isFirebaseConfigured && db) {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const q = query(messagesRef);

      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const liveMessages: Message[] = snapshot.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  senderId: data.senderId,
                  senderName: data.senderName,
                  type: data.type,
                  content: data.content,
                  viewStatus: data.viewStatus,
                  duration: data.duration,
                  createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
                  viewedAt: data.viewedAt?.toMillis ? data.viewedAt.toMillis() : data.viewedAt,
                  replyTo: data.replyTo || undefined,
                };
              })
              .sort((a, b) => a.createdAt - b.createdAt);

            callback(liveMessages);
          }
        },
        (err) => {
          console.warn('Firestore messages notice (using resilient mockStore):', err?.message || err);
          callback(mockStore.getMessages(chatId));
        }
      );
    } catch (err) {
      console.warn('Firestore messages setup error:', err);
    }
  }

  return () => {
    unsubMock();
    if (unsubFirestore) {
      try {
        unsubFirestore();
      } catch (e) {}
    }
  };
}

/**
 * Sends a chat message or ephemeral snap.
 */
export async function sendMessage(
  chatId: string,
  message: {
    senderId: string;
    senderName?: string;
    type: 'text' | 'image' | 'video';
    content: string;
    duration?: number;
    replyTo?: import('@/types').ReplyTo;
  }
): Promise<Message> {
  const now = Date.now();
  const msgData = {
    senderId: message.senderId,
    senderName: message.senderName,
    type: message.type,
    content: message.content,
    viewStatus: 'delivered' as SnapViewStatus,
    duration: message.duration || 10,
    createdAt: now,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  };

  // 1. Immediately store locally and notify subscribers
  const localMsg = mockStore.sendMessage(chatId, msgData);

  // 2. Synchronously or asynchronously attempt Firestore push
  if (isFirebaseConfigured && db) {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const docRef = await addDoc(messagesRef, {
        ...msgData,
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'chats', chatId),
        {
          participants: [message.senderId],
          updatedAt: serverTimestamp(),
          lastMessage: {
            content: message.type === 'text' ? message.content : `[${message.type.toUpperCase()} SNAP]`,
            type: message.type,
            senderId: message.senderId,
            viewStatus: 'delivered',
            createdAt: now,
            isReply: Boolean(message.replyTo),
            replyToSenderId: message.replyTo?.senderId,
            replyToSenderName: message.replyTo?.senderName,
          },
        },
        { merge: true }
      );

      return { id: docRef.id, ...msgData };
    } catch (e: any) {
      console.warn('Firestore write notice (saved in local store):', e?.message || e);
      return localMsg;
    }
  }

  return localMsg;
}

/**
 * Marks an ephemeral snap message as viewed and triggers permanent deletion protocol (unless saved).
 */
export async function markSnapViewed(
  chatId: string,
  messageId: string,
  mediaUrl?: string,
  isSaved?: boolean
): Promise<void> {
  // Always update locally first
  mockStore.markSnapViewed(chatId, messageId);

  if (isFirebaseConfigured && db) {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await updateDoc(msgRef, {
        viewStatus: 'viewed',
        viewedAt: serverTimestamp(),
      });

      // Update chat document lastMessage status
      try {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          'lastMessage.viewStatus': 'viewed',
          'lastMessage.viewedAt': serverTimestamp(),
        });
      } catch (e) {}

      // Only purge if NOT explicitly saved by the user
      if (mediaUrl && !isSaved) {
        fetch('/api/storage/purge-expired', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaUrl, messageId }),
        }).catch((e) => console.log('Purge call completed:', e));
      }
    } catch (e: any) {
      console.warn('Firestore markSnapViewed notice:', e?.message || e);
    }
  }
}

/**
 * Marks text messages in a chat as read/viewed by the recipient.
 */
export async function markChatMessagesAsRead(
  chatId: string,
  readerUid: string
): Promise<void> {
  mockStore.markChatMessagesAsRead(chatId, readerUid);

  if (isFirebaseConfigured && db) {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const q = query(messagesRef, where('viewStatus', '==', 'delivered'));
      const snapshot = await getDocs(q);
      const updates = snapshot.docs
        .filter((d) => d.data().senderId !== readerUid && d.data().type === 'text')
        .map((d) => updateDoc(d.ref, { viewStatus: 'viewed', viewedAt: serverTimestamp() }));
      await Promise.all(updates);

      // Update chat lastMessage
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        'lastMessage.viewStatus': 'viewed',
        'lastMessage.viewedAt': serverTimestamp(),
      });
    } catch (e: any) {
      console.warn('Firestore markChatMessagesAsRead notice:', e?.message || e);
    }
  }
}

/**
 * Saves a snap to the chat history and user's saved collection.
 */
export async function saveSnap(
  chatId: string,
  messageId: string,
  savedByUid: string,
  savedByName: string
): Promise<void> {
  mockStore.saveSnap(chatId, messageId, savedByUid, savedByName);

  if (isFirebaseConfigured && db) {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await updateDoc(msgRef, {
        isSaved: true,
        savedBy: arrayUnion(savedByUid),
        savedByName,
        savedAt: serverTimestamp(),
      });

      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        'lastMessage.isSaved': true,
        'lastMessage.savedByName': savedByName,
      });
    } catch (e: any) {
      console.warn('Firestore saveSnap notice:', e?.message || e);
    }
  }
}

/**
 * Updates the debounced typing indicator on the chat document.
 */
export async function setTypingStatus(
  chatId: string,
  userId: string,
  isTyping: boolean
): Promise<void> {
  // Update locally first
  mockStore.setTyping(chatId, userId, isTyping);

  if (isFirebaseConfigured && db) {
    try {
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        [`typing.${userId}`]: isTyping,
      });
    } catch (e: any) {
      console.warn('Firestore typing indicator notice:', e?.message || e);
    }
  }
}
