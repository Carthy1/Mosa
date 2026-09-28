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
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { mockStore, DEFAULT_USER, DEMO_FRIENDS } from '../mock/mockStore';
import { UserProfile, Story, Chat, Message, SnapViewStatus } from '@/types';

// ========================
// USERS COLLECTION
// ========================

/**
 * Safely converts any timestamp representation (number, Firestore Timestamp, Date, serialized seconds, object) to milliseconds.
 */
export function toTimestampMillis(val: any): number {
  if (!val) return Date.now();
  if (typeof val === 'number') {
    if (val < 10000000000) return val * 1000;
    return val;
  }
  if (typeof val.toMillis === 'function') {
    return val.toMillis();
  }
  if (val && typeof val === 'object') {
    const sec = Number(val.seconds ?? val._seconds);
    if (!isNaN(sec) && sec > 0) {
      const nano = Number(val.nanoseconds ?? val._nanoseconds) || 0;
      return sec * 1000 + Math.floor(nano / 1000000);
    }
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? Date.now() : val.getTime();
  }
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num) && num > 100000) {
      if (num < 10000000000) return num * 1000;
      return num;
    }
    const p = Date.parse(val);
    if (!isNaN(p)) return p;
  }
  return Date.now();
}

export function formatChatTime(val: any): string {
  if (!val) return '';
  const ms = toTimestampMillis(val);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatReceiptTime(val: any): string {
  if (!val) return '';
  const ms = toTimestampMillis(val);
  const now = Date.now();
  const diffSec = Math.floor((now - ms) / 1000);
  if (diffSec < 0 || diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Evaluates whether a user is currently online based on isOnline flag and recent heartbeat (<75 seconds).
 */
export function isUserCurrentlyOnline(profile?: { isOnline?: boolean; lastSeen?: any } | null): boolean {
  if (!profile) return false;
  if (!profile.isOnline) return false;
  if (!profile.lastSeen) return true;
  const ms = toTimestampMillis(profile.lastSeen);
  return Date.now() - ms < 75000;
}

/**
 * Formats a user's presence / last seen timestamp into human-friendly representation.
 * Example: 'Online', 'Last seen just now', 'Last seen 5m ago', 'Last seen today at 2:30 PM'
 */
export function formatLastSeen(lastSeen?: any, isOnline?: boolean): string {
  if (isUserCurrentlyOnline({ isOnline, lastSeen })) {
    return 'Online';
  }
  if (!lastSeen) {
    return 'Offline';
  }

  const ms = toTimestampMillis(lastSeen);
  const now = Date.now();
  const diffSec = Math.floor((now - ms) / 1000);

  if (diffSec < 60) return 'Last seen just now';
  if (diffSec < 3600) return `Last seen ${Math.floor(diffSec / 60)}m ago`;

  const d = new Date(ms);
  if (isNaN(d.getTime())) return 'Offline';

  const nowDate = new Date(now);
  const isToday =
    d.getDate() === nowDate.getDate() &&
    d.getMonth() === nowDate.getMonth() &&
    d.getFullYear() === nowDate.getFullYear();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Last seen today at ${timeStr}`;
  }

  const yesterdayDate = new Date(now - 86400000);
  const isYesterday =
    d.getDate() === yesterdayDate.getDate() &&
    d.getMonth() === yesterdayDate.getMonth() &&
    d.getFullYear() === yesterdayDate.getFullYear();

  if (isYesterday) {
    return `Last seen yesterday at ${timeStr}`;
  }

  if (d.getFullYear() === nowDate.getFullYear()) {
    return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  }

  return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/**
 * Sets current user's online presence status and updates heartbeat lastSeen timestamp.
 */
export async function setUserOnlineStatus(uid: string, isOnline: boolean): Promise<void> {
  if (!uid) return;
  mockStore.setUserOnlineStatus(uid, isOnline);

  if (isFirebaseConfigured && db && !uid.startsWith('user_')) {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(
        userRef,
        {
          isOnline,
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e: any) {
      console.warn('Firestore setUserOnlineStatus notice:', e?.message || e);
    }
  }
}

/**
 * Subscribes to a single user's profile and presence in real-time.
 */
export function subscribeUserProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void
): () => void {
  getUserProfile(uid).then((p) => {
    if (p) callback(p);
  });

  const unsubMock = mockStore.subscribe(() => {
    const p = mockStore.getUser(uid);
    if (p) callback(p);
  });

  let unsubFirestore: (() => void) | null = null;
  if (isFirebaseConfigured && db && !uid.startsWith('user_')) {
    try {
      unsubFirestore = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            if (data) {
              mockStore.saveUser(data);
              callback(data);
            }
          }
        },
        (err) => console.warn('Firestore user profile listener notice:', err)
      );
    } catch (e) {}
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
 * Real-time listener for presence map of all users.
 */
export function subscribeUsersPresence(
  callback: (presenceMap: Record<string, { isOnline: boolean; lastSeen: number }>) => void
): () => void {
  const getMap = async () => {
    const all = await getAllUsers();
    const map: Record<string, { isOnline: boolean; lastSeen: number }> = {};
    all.forEach((u) => {
      map[u.uid] = {
        isOnline: Boolean(u.isOnline),
        lastSeen: toTimestampMillis(u.lastSeen),
      };
    });
    return map;
  };

  getMap().then(callback);

  const unsubMock = mockStore.subscribe(async () => {
    const map = await getMap();
    callback(map);
  });

  let unsubFirestore: (() => void) | null = null;
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          const map: Record<string, { isOnline: boolean; lastSeen: number }> = {};
          snapshot.forEach((d) => {
            const data = d.data() as UserProfile;
            if (data && data.uid) {
              map[data.uid] = {
                isOnline: Boolean(data.isOnline),
                lastSeen: toTimestampMillis(data.lastSeen),
              };
            }
          });
          callback(map);
        },
        (err) => console.warn('Firestore users presence notice:', err)
      );
    } catch (e) {}
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

/**
 * Real-time listener for community users.
 * Automatically updates when any user creates an account or logs in anywhere.
 */
export function subscribeAllUsers(
  currentUid: string,
  callback: (users: UserProfile[]) => void
): () => void {
  getAllUsers().then((initial) => {
    callback(initial.filter((u) => u.uid !== currentUid));
  });

  const unsubMock = mockStore.subscribe(async () => {
    const updated = await getAllUsers();
    callback(updated.filter((u) => u.uid !== currentUid));
  });

  let unsubFirestore: (() => void) | null = null;
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          snapshot.forEach((d) => {
            const data = d.data() as UserProfile;
            if (data && data.uid && data.uid !== currentUid) {
              mockStore.saveUser(data);
            }
          });
          getAllUsers().then((all) => {
            callback(all.filter((u) => u.uid !== currentUid));
          });
        },
        (err) => console.warn('Firestore live users notice:', err)
      );
    } catch (e) {
      console.warn('Firestore live users setup error:', e);
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
 * Fetch full UserProfile objects for a list of friend UIDs.
 */
export async function getFriendsProfiles(friendUids: string[]): Promise<UserProfile[]> {
  if (!friendUids || friendUids.length === 0) return [];
  const results: UserProfile[] = [];

  for (const fUid of friendUids) {
    if (isFirebaseConfigured && db && !fUid.startsWith('user_')) {
      try {
        const uDoc = await getDoc(doc(db, 'users', fUid));
        if (uDoc.exists()) {
          results.push(uDoc.data() as UserProfile);
          continue;
        }
      } catch (e) {}
    }
    if (DEMO_FRIENDS[fUid]) {
      results.push(DEMO_FRIENDS[fUid]);
      continue;
    }
    const mockU = mockStore.getUser(fUid);
    if (mockU) results.push(mockU);
  }

  return results;
}

/**
 * Real-time listener for current user's friends list.
 */
export function subscribeUserFriends(
  uid: string,
  callback: (friends: UserProfile[]) => void
): () => void {
  if (!isFirebaseConfigured || !db || uid.startsWith('user_')) {
    callback(mockStore.getFriends());
    return () => {};
  }

  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(doc(db, 'users', uid), async (docSnap) => {
      if (docSnap.exists()) {
        const uData = docSnap.data() as UserProfile;
        const friendsList = await getFriendsProfiles(uData.friends || []);
        callback(friendsList);
      } else {
        callback([]);
      }
    });
  } catch (e) {
    console.warn('subscribeUserFriends error:', e);
  }

  return () => {
    if (unsub) unsub();
  };
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

  if (!found) {
    return null;
  }

  // 4. Bidirectional friend linking and chat initialization in Firestore
  if (isFirebaseConfigured && db && currentUid && currentUid !== found.uid) {
    try {
      await updateDoc(doc(db, 'users', currentUid), {
        friends: arrayUnion(found.uid),
      }).catch(console.warn);

      await updateDoc(doc(db, 'users', found.uid), {
        friends: arrayUnion(currentUid),
      }).catch(console.warn);

      // Fetch my profile for chat metadata
      let myProfile: any = { uid: currentUid };
      try {
        const mySnap = await getDoc(doc(db, 'users', currentUid));
        if (mySnap.exists()) {
          const d = mySnap.data();
          myProfile = {
            uid: currentUid,
            displayName: d.displayName || 'User',
            username: d.username || 'user',
            photoURL: d.photoURL || null,
          };
        }
      } catch (e) {}

      const canonicalChatId = getCanonicalChatId(currentUid, found.uid);
      await setDoc(
        doc(db, 'chats', canonicalChatId),
        {
          participants: [currentUid, found.uid],
          participantProfiles: {
            [currentUid]: myProfile,
            [found.uid]: {
              uid: found.uid,
              displayName: found.displayName,
              username: found.username,
              photoURL: found.photoURL || null,
            },
          },
          updatedAt: serverTimestamp(),
          typing: {
            [currentUid]: false,
            [found.uid]: false,
          },
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
  const isRealUser = Boolean(isFirebaseConfigured && currentUid && !currentUid.startsWith('user_'));

  if (!isRealUser) {
    // 1. Unauthenticated or offline demo mode: use mockStore demo chats
    callback(mockStore.getChats());
    const unsubMock = mockStore.subscribe(() => {
      callback(mockStore.getChats());
    });
    return unsubMock;
  }

  // 2. Real Authenticated User: STRICT PRIVACY.
  // ONLY return chats where currentUid is explicitly in participants.
  // Never merge demo chats into a real user's private inbox.
  let unsubFirestore: (() => void) | null = null;
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUid)
      );

      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const liveChats: Chat[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              const lastMsg = data.lastMessage;
              return {
                id: d.id,
                participants: data.participants || [],
                participantProfiles: data.participantProfiles || {},
                updatedAt: toTimestampMillis(data.updatedAt),
                typing: data.typing || {},
                lastMessage: lastMsg
                  ? {
                      ...lastMsg,
                      id: lastMsg.id || '',
                      content: lastMsg.content || '',
                      type: lastMsg.type || 'text',
                      senderId: lastMsg.senderId || '',
                      viewStatus: lastMsg.viewStatus || 'delivered',
                      createdAt: toTimestampMillis(lastMsg.createdAt),
                      viewedAt: lastMsg.viewedAt ? toTimestampMillis(lastMsg.viewedAt) : undefined,
                      isSaved: Boolean(lastMsg.isSaved),
                      savedByName: lastMsg.savedByName,
                    }
                  : undefined,
              };
            })
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

          callback(liveChats);
        },
        (err) => {
          console.warn('Firestore chats query error:', err?.message || err);
          callback([]);
        }
      );
    } catch (err) {
      console.warn('Firestore chats query error:', err);
      callback([]);
    }
  } else {
    callback([]);
  }

  return () => {
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
  // If it's one of the legacy mock seed chats
  if (chatId === 'chat_elena' || chatId === 'chat_alex' || chatId === 'chat_sarah') {
    callback(mockStore.getMessages(chatId));
    const unsubMock = mockStore.subscribe(() => {
      callback(mockStore.getMessages(chatId));
    });
    return unsubMock;
  }

  let unsubFirestore: (() => void) | null = null;
  if (isFirebaseConfigured && db) {
    try {
      // Send immediate local cached messages to avoid blank flash
      const localCached = mockStore.getMessages(chatId);
      if (localCached && localCached.length > 0) {
        callback(localCached);
      }

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const q = query(messagesRef);

      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const liveMessages: Message[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                senderId: data.senderId,
                senderName: data.senderName,
                type: data.type,
                content: data.content,
                viewStatus: data.viewStatus || 'delivered',
                duration: data.duration,
                createdAt: toTimestampMillis(data.createdAt),
                viewedAt: data.viewedAt ? toTimestampMillis(data.viewedAt) : undefined,
                replyTo: data.replyTo || undefined,
                isSaved: Boolean(data.isSaved),
                savedByName: data.savedByName,
                savedBy: data.savedBy,
              };
            })
            .sort((a, b) => a.createdAt - b.createdAt);

          callback(liveMessages);
        },
        (err) => {
          console.warn('Firestore messages notice:', err?.message || err);
          callback(mockStore.getMessages(chatId));
        }
      );
    } catch (err) {
      console.warn('Firestore messages setup error:', err);
      callback(mockStore.getMessages(chatId));
    }
  } else {
    callback(mockStore.getMessages(chatId));
    const unsubMock = mockStore.subscribe(() => {
      callback(mockStore.getMessages(chatId));
    });
    return unsubMock;
  }

  return () => {
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
    isSaved?: boolean;
    savedBy?: string[];
    savedByName?: string;
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
    ...(message.isSaved
      ? {
          isSaved: true,
          savedBy: message.savedBy || [message.senderId],
          savedByName: message.savedByName || message.senderName || '',
          savedAt: now,
        }
      : {}),
  };

  // 1. Immediately store locally and notify subscribers
  const localMsg = mockStore.sendMessage(chatId, msgData);

  // 2. Synchronously or asynchronously attempt Firestore push
  if (isFirebaseConfigured && db) {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const docRef = doc(messagesRef);

      const recipientUid = typeof recipient === 'string' ? recipient : recipient?.uid;
      const participantUids = [message.senderId];
      if (recipientUid && recipientUid !== message.senderId) {
        participantUids.push(recipientUid);
      }

      const chatUpdate: any = {
        participants: arrayUnion(...participantUids),
        updatedAt: serverTimestamp(),
        lastMessage: {
          id: docRef.id,
          content: message.type === 'text' ? message.content : `[${message.type.toUpperCase()} SNAP]`,
          type: message.type,
          senderId: message.senderId,
          senderName: message.senderName || '',
          viewStatus: 'delivered',
          createdAt: now,
          viewedAt: null,
          isReply: Boolean(message.replyTo),
          replyToSenderId: message.replyTo?.senderId || null,
          replyToSenderName: message.replyTo?.senderName || null,
          isSaved: Boolean(message.isSaved),
          savedByName: message.savedByName || message.senderName || '',
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

      // Atomically commit both message doc and chat update in a single batch
      const batch = writeBatch(db);
      batch.set(docRef, {
        ...msgData,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'chats', chatId), chatUpdate, { merge: true });
      await batch.commit();

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

      // Update chat document lastMessage status ONLY IF this snap is the last message
      try {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
          const cData = chatSnap.data();
          const lastMsg = cData.lastMessage;
          if (
            lastMsg &&
            (lastMsg.id === messageId ||
              (!lastMsg.id && (lastMsg.content === mediaUrl || (mediaUrl && lastMsg.content?.includes(mediaUrl)))))
          ) {
            await updateDoc(chatRef, {
              'lastMessage.viewStatus': 'viewed',
              'lastMessage.viewedAt': serverTimestamp(),
            });
          }
        }
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
  readerUid: string,
  messageIds?: string[]
): Promise<void> {
  mockStore.markChatMessagesAsRead(chatId, readerUid);

  if (isFirebaseConfigured && db) {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      let textDocsToUpdate: Array<{ id: string; ref: any }> = [];

      if (messageIds && messageIds.length > 0) {
        textDocsToUpdate = messageIds.map((id) => ({
          id,
          ref: doc(db, 'chats', chatId, 'messages', id),
        }));
      } else {
        // Query only with equality on viewStatus so no composite index is required in Firestore
        const q = query(
          messagesRef,
          where('viewStatus', '==', 'delivered')
        );
        const snapshot = await getDocs(q);
        textDocsToUpdate = snapshot.docs
          .filter((d) => {
            const data = d.data();
            return data.senderId !== readerUid && (data.type === 'text' || !data.type);
          })
          .map((d) => ({ id: d.id, ref: d.ref }));

        // Comprehensive sweep: if delivered query returned 0, check all messages in chat for any delivered/unviewed
        if (textDocsToUpdate.length === 0) {
          try {
            const allSnap = await getDocs(messagesRef);
            textDocsToUpdate = allSnap.docs
              .filter((d) => {
                const data = d.data();
                return data.senderId !== readerUid && data.viewStatus !== 'viewed' && (data.type === 'text' || !data.type);
              })
              .map((d) => ({ id: d.id, ref: d.ref }));
          } catch (sweepErr) {
            console.warn('Fallback messages sweep notice:', sweepErr);
          }
        }
      }

      if (textDocsToUpdate.length > 0) {
        const now = serverTimestamp();
        const batch = writeBatch(db);
        textDocsToUpdate.slice(0, 450).forEach((d) => {
          batch.update(d.ref, { viewStatus: 'viewed', viewedAt: now });
        });

        // Safely check and update chat header in the same atomic batch
        try {
          const chatRef = doc(db, 'chats', chatId);
          const chatSnap = await getDoc(chatRef);
          if (chatSnap.exists()) {
            const cData = chatSnap.data();
            const lastMsg = cData.lastMessage;
            if (lastMsg && (lastMsg.senderId !== readerUid || textDocsToUpdate.some((d) => d.id === lastMsg.id))) {
              batch.update(chatRef, {
                'lastMessage.viewStatus': 'viewed',
                'lastMessage.viewedAt': now,
              });
            }
          }
        } catch (chatHeaderErr) {
          console.warn('Chat header update notice in markRead:', chatHeaderErr);
        }

        await batch.commit();
      } else {
        // Fallback: If no message docs array provided, ensure chat lastMessage is updated
        try {
          const chatRef = doc(db, 'chats', chatId);
          const chatSnap = await getDoc(chatRef);
          if (chatSnap.exists()) {
            const cData = chatSnap.data();
            const lastMsg = cData.lastMessage;
            if (lastMsg && lastMsg.senderId !== readerUid && lastMsg.viewStatus !== 'viewed') {
              await updateDoc(chatRef, {
                'lastMessage.viewStatus': 'viewed',
                'lastMessage.viewedAt': serverTimestamp(),
              });
            }
          }
        } catch (e) {}
      }
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
      await setDoc(
        msgRef,
        {
          isSaved: true,
          savedBy: arrayUnion(savedByUid),
          savedByName,
          savedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const cData = chatSnap.data();
        const lastMsg = cData.lastMessage;
        if (lastMsg && (lastMsg.id === messageId || (!lastMsg.id && lastMsg.content?.includes(messageId)))) {
          await updateDoc(chatRef, {
            'lastMessage.isSaved': true,
            'lastMessage.savedByName': savedByName,
          });
        }
      }
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
