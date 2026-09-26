import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';
import { mockStore, DEFAULT_USER } from '../mock/mockStore';
import { UserProfile } from '@/types';

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  if (isFirebaseConfigured && auth) {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await syncSessionCookie(await cred.user.getIdToken());
    return {
      uid: cred.user.uid,
      displayName: cred.user.displayName || email.split('@')[0],
      email: cred.user.email || '',
      username: (cred.user.displayName || email.split('@')[0]).toLowerCase().replace(/\s+/g, '_'),
      photoURL: cred.user.photoURL || undefined,
      friends: [],
      createdAt: Date.now(),
    };
  }

  // Standalone / Mock fallback
  const user = mockStore.getCurrentUser();
  await syncSessionCookie('mock-session-token-' + user.uid);
  return user;
}

export async function registerWithEmail(email: string, pass: string, username: string, displayName: string): Promise<UserProfile> {
  if (isFirebaseConfigured && auth) {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await syncSessionCookie(await cred.user.getIdToken());
    return {
      uid: cred.user.uid,
      displayName,
      email,
      username,
      friends: [],
      createdAt: Date.now(),
    };
  }

  const updated = mockStore.updateCurrentUser({
    username,
    displayName,
    email,
  });
  await syncSessionCookie('mock-session-token-' + updated.uid);
  return updated;
}

export async function loginWithGoogle(): Promise<UserProfile> {
  if (isFirebaseConfigured && auth) {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    await syncSessionCookie(await cred.user.getIdToken());
    return {
      uid: cred.user.uid,
      displayName: cred.user.displayName || 'Google User',
      email: cred.user.email || '',
      username: (cred.user.displayName || 'user').toLowerCase().replace(/\s+/g, '_'),
      photoURL: cred.user.photoURL || undefined,
      friends: [],
      createdAt: Date.now(),
    };
  }

  const user = mockStore.getCurrentUser();
  await syncSessionCookie('mock-session-token-' + user.uid);
  return user;
}

export async function loginAsDemo(username: string = 'maccarthy_qa'): Promise<UserProfile> {
  const user = mockStore.getCurrentUser();
  await syncSessionCookie('mock-session-token-' + user.uid);
  return user;
}

export async function logout(): Promise<void> {
  if (isFirebaseConfigured && auth) {
    await fbSignOut(auth);
  }
  await fetch('/api/auth/session', { method: 'DELETE' });
}

export async function syncSessionCookie(token: string) {
  try {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.warn('Failed to sync session cookie with edge route', err);
  }
}
