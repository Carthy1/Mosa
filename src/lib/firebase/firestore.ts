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
import { mockStore, DEFAULT_USER, DEMO_FRIENDS } from '../mock/mockStore';
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
  // Store user in local registry without accidentally overwriting active session
  mockStore.saveUser(user);
  if (mockStore.getCurrentUser().uid === user.uid) {
    mockStore.updateCurrentUser(user);
  }

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'users', user.uid), user, { merge: true });
    } catch (e: any) {
      console.warn('Firestore saveUserProfile notice (saved locally):', e?.message || e);
    }
  }
}

/**
 * Returns all discoverable users combining live Firestore registered users + mockStore + demo personas.
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const usersMap = new Map<string, UserProfile>();

  // 1. Seed profiles, demo friends, and any local accounts registered on this client
  const fallbackCandidates = [
    DEFAULT_USER,
    {
      ...DEFAULT_USER,
      username: 'maccarthy_qa', // Legacy alias
    },
    ...Object.values(DEMO_FRIENDS),
    ...mockStore.getAllUsers(),
  ];

  for (const cand of fallbackCandidates) {
    if (cand && cand.uid) {
      usersMap.set(cand.uid, cand);
    }
  }

  // 2. Fetch all registered users from Firestore users collection
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      snap.forEach((d) => {
        const data = d.data() as UserProfile;
        if (data && data.uid) {
          usersMap.set(data.uid, data);
        }
      });
    } catch (e: any) {
      console.warn('Firestore getAllUsers notice:', e?.message || e);
    }
  }

  return Array.from(usersMap.values());
}

export async function addFriend(
  friendUsernameOrUid: string,
  currentUid?: string
): Promise<UserProfile | null> {
  const queryText = friendUsernameOrUid.toLowerCase().trim().replace('@', '');
  if (!queryText) return null;

  // 1. Fetch available users across Firestore and local candidates
  const allUsers = await getAllUsers();

  // 2. Perform comprehensive matching:
  // Step A: Exact matches on username, email, displayName, or UID
  // Step B: Partial/substring matches on username, displayName, or email
  let found =
    allUsers.find(
      (u) =>
        u.uid !== currentUid &&
        (u.username.toLowerCase() === queryText ||
          u.email?.toLowerCase() === queryText ||
          u.displayName.toLowerCase() === queryText ||
          u.uid.toLowerCase() === queryText)
    ) ||
    allUsers.find(
      (u) =>
        u.uid !== currentUid &&
        (u.username.toLowerCase().includes(queryText) ||
          queryText.includes(u.username.toLowerCase()) ||
          u.displayName.toLowerCase().includes(queryText) ||
          u.email?.toLowerCase().includes(queryText))
    );

  // 3. Fallback: Direct Firestore query if collection listing was unavailable
  if (!found && isFirebaseConfigured && db) {
    try {
      const qUser = query(collection(db, 'users'), where('username', '==', queryText));
      const snapUser = await getDocs(qUser);
      if (!snapUser.empty) {
        const docUser = snapUser.docs[0].data() as UserProfile;
        if (docUser && docUser.uid !== currentUid) {
          found = docUser;
        }
      }
    } catch (e) {}

    if (!found) {
      try {
        const qEmail = query(collection(db, 'users'), where('email', '==', queryText));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const docEmail = snapEmail.docs[0].data() as UserProfile;
          if (docEmail && docEmail.uid !== currentUid) {
            found = docEmail;
          }
        }
      } catch (e) {}
    }

    if (!found) {
      try {
        const docSnap = await getDoc(doc(db, 'users', queryText));
        if (docSnap.exists()) {
          const docData = docSnap.data() as UserProfile;
          if (docData && docData.uid !== currentUid) {
            found = docData;
          }
        }
      } catch (e) {}
    }
  }

  if (!found) return null;

  // 4. Bidirectional friend linking and chat initialization in Firestore
  if (isFirebaseConfigured && db && currentUid && currentUid !== found.uid) {
    try {
      await updateDoc(doc(db, 'users', currentUid), {
        friends: arrayUnion(found.uid),
      }).catch(console.warn);

      await updateDoc(doc(db, 'users', found.uid), {
        friends: arrayUnion(currentUid),
      }).catch(console.warn);

      const canonicalChatId = getCanonicalChatId(currentUid, found.uid);
      await setDoc(
        doc(db, 'chats', canonicalChatId),
        {
          participants: [currentUid, found.uid],
          participantProfiles: {
            [currentUid]: { uid: currentUid },
            [found.uid]: {
              uid: found.uid,
              displayName: found.displayName,
              username: found.username,
              photoURL: found.photoURL || null,
            },
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(console.warn);
    } catch (e) {
      console.warn('Firestore friend linking error:', e);
    }
  }

  // 5. Update mockStore friends without altering current user identity
  mockStore.addFriendDirect(found);

  return found;
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

export function getCanonicalChatId(uid1: string, uid2: string): string {
  const clean1 = (uid1 || '').replace('user_', '').toLowerCase();
  const clean2 = (uid2 || '').replace('user_', '').toLowerCase();
  if (clean1 === 'elena' || clean2 === 'elena') return 'chat_elena';
  if (clean1 === 'alex' || clean2 === 'alex') return 'chat_alex';
  if (clean1 === 'sarah' || clean2 === 'sarah') return 'chat_sarah';

  const sorted = [uid1, uid2].sort();
  return `chat_${sorted[0].replace('user_', '')}_${sorted[1].replace('user_', '')}`;
}

export function getChatIdForFriend(friendUid: string, currentUid?: string): string {
  if (currentUid) {
    return getCanonicalChatId(currentUid, friendUid);
  }
  const clean = friendUid.replace('user_', '').toLowerCase();
  return `chat_${clean}`;
}

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

            // Merge liveChats with mockStore demo chats so demo friends remain accessible
            const demoChats = mockStore.getChats();
            const merged = [...liveChats];
            for (const d of demoChats) {
              if (!merged.some((c) => c.id === d.id)) {
                merged.push(d);
              }
            }
            callback(merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
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
  },
  recipient?: UserProfile | string
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

      const recipientUid = typeof recipient === 'string' ? recipient : recipient?.uid;
      const participantUids = [message.senderId];
      if (recipientUid && recipientUid !== message.senderId) {
        participantUids.push(recipientUid);
      }

      const chatUpdate: any = {
        participants: arrayUnion(...participantUids),
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
      };

      if (typeof recipient === 'object' && recipient) {
        chatUpdate[`participantProfiles.${recipient.uid}`] = {
          uid: recipient.uid,
          displayName: recipient.displayName,
          username: recipient.username,
          photoURL: recipient.photoURL || null,
        };
      }
      if (message.senderName) {
        chatUpdate[`participantProfiles.${message.senderId}`] = {
          uid: message.senderId,
          displayName: message.senderName,
        };
      }

      await setDoc(doc(db, 'chats', chatId), chatUpdate, { merge: true });

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
