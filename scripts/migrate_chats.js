const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const config = {};
envFile.split('\n').forEach((line) => {
  const idx = line.indexOf('=');
  if (idx > -1) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    config[key] = val;
  }
});

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} = require('firebase/firestore');

const app = initializeApp({
  apiKey: config.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: config.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: config.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: config.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

const MACCARTHY_UID = 'fVqUY2z9YaM8p4nGSjwgbSkJP4G3';
const BLACK_UID = 'UO7vQolU0fbyi2os0NxGOJQsRCD2';

async function migrate() {
  console.log('--- Step 1: Linking MacCarthy and Black in Firestore users collection ---');
  await updateDoc(doc(db, 'users', MACCARTHY_UID), {
    friends: [BLACK_UID],
  });
  console.log('Updated MacCarthy friends ->', [BLACK_UID]);

  await updateDoc(doc(db, 'users', BLACK_UID), {
    friends: [MACCARTHY_UID],
  });
  console.log('Updated Black friends ->', [MACCARTHY_UID]);

  console.log('--- Step 2: Creating real canonical chat between MacCarthy and Black ---');
  const sorted = [MACCARTHY_UID, BLACK_UID].sort();
  const canonicalChatId = `chat_${sorted[0]}_${sorted[1]}`;
  console.log('Canonical Chat ID:', canonicalChatId);

  // Read any existing messages from the old chat
  const oldChatDoc = doc(db, 'chats', 'chat_fVqUY2z9YaM8p4nGSjwgbSkJP4G3_black');
  const oldMsgsSnap = await getDocs(collection(db, 'chats', 'chat_fVqUY2z9YaM8p4nGSjwgbSkJP4G3_black', 'messages'));
  console.log('Found messages in old chat:', oldMsgsSnap.size);

  const newChatRef = doc(db, 'chats', canonicalChatId);
  await setDoc(
    newChatRef,
    {
      participants: [MACCARTHY_UID, BLACK_UID],
      participantProfiles: {
        [MACCARTHY_UID]: {
          uid: MACCARTHY_UID,
          displayName: 'MacCarthy Collins Setor',
          username: 'maccarthy_collins_setor',
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        },
        [BLACK_UID]: {
          uid: BLACK_UID,
          displayName: 'Black',
          username: 'black',
          photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
        },
      },
      updatedAt: serverTimestamp(),
      typing: {
        [MACCARTHY_UID]: false,
        [BLACK_UID]: false,
      },
      lastMessage: {
        content: 'Hey! Connected on Mosa ✨',
        type: 'text',
        senderId: MACCARTHY_UID,
        viewStatus: 'delivered',
        createdAt: Date.now(),
      },
    },
    { merge: true }
  );

  // Copy messages to new chat
  for (const mDoc of oldMsgsSnap.docs) {
    const data = mDoc.data();
    await setDoc(doc(db, 'chats', canonicalChatId, 'messages', mDoc.id), data);
  }

  // Also clean up old dummy chats so no confusion exists
  try {
    await deleteDoc(doc(db, 'chats', 'chat_fVqUY2z9YaM8p4nGSjwgbSkJP4G3_black'));
    await deleteDoc(doc(db, 'chats', 'chat_fVqUY2z9YaM8p4nGSjwgbSkJP4G3_mailto_oaasare1gmail_com'));
    console.log('Cleaned up old placeholder chats');
  } catch (e) {
    console.warn('Cleanup notice:', e.message);
  }

  console.log('Migration completed successfully!');
}

migrate().catch(console.error);
