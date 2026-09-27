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
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const app = initializeApp({
  apiKey: config.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: config.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: config.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: config.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

async function inspect() {
  console.log('=== USERS IN FIRESTORE ===');
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log('Total users count:', usersSnap.size);
  usersSnap.forEach((d) => console.log('User ID:', d.id, JSON.stringify(d.data(), null, 2)));

  console.log('=== CHATS IN FIRESTORE ===');
  const chatsSnap = await getDocs(collection(db, 'chats'));
  console.log('Total chats count:', chatsSnap.size);
  chatsSnap.forEach((d) => console.log('Chat ID:', d.id, JSON.stringify(d.data(), null, 2)));
}

inspect().catch((err) => console.error('Error during inspect:', err));
