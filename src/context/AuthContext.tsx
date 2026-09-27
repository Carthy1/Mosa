'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase/config';
import { getUserProfile, saveUserProfile } from '@/lib/firebase/firestore';
import { mockStore, DEFAULT_USER } from '@/lib/mock/mockStore';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isFirebaseLive: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, username: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchUser: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function formatFirebaseError(err: any): Error {
  const code = err?.code || '';
  if (code.includes('api-key-not-valid') || err?.message?.includes('API key not valid')) {
    return new Error(
      'Firebase API key is being initialized or Authentication is not yet enabled. In Firebase Console (mosa-f9dfa), go to "Authentication" -> "Get started" -> "Sign-in method" and enable Email/Password.'
    );
  }
  if (code.includes('operation-not-allowed')) {
    return new Error(
      'Email/Password provider is disabled. Enable it in Firebase Console -> Authentication -> Sign-in method.'
    );
  }
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return new Error('Invalid email or password. Please verify your credentials or create a new account.');
  }
  if (code.includes('email-already-in-use')) {
    return new Error('This email is already registered. Please sign in instead.');
  }
  return new Error(err.message || 'Authentication failed');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirebaseLive = isFirebaseConfigured;

  const getSavedLocalUser = (): UserProfile | null => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('mosa_auth_user') || localStorage.getItem('ephemeral_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid) return parsed;
      }
    } catch (e) {}
    return null;
  };

  const persistLocalUser = (profile: UserProfile | null) => {
    if (typeof window === 'undefined') return;
    try {
      if (profile) {
        localStorage.setItem('mosa_auth_user', JSON.stringify(profile));
        localStorage.setItem('ephemeral_current_user', JSON.stringify(profile));
      } else {
        localStorage.removeItem('mosa_auth_user');
        localStorage.removeItem('ephemeral_current_user');
      }
    } catch (e) {}
  };

  useEffect(() => {
    // If real Firebase is initialized, listen for live auth changes
    if (isFirebaseConfigured && auth) {
      try {
        const unsubscribe = onAuthStateChanged(
          auth,
          async (fbUser) => {
            setFirebaseUser(fbUser);
            if (fbUser) {
              // Sync session cookie with Edge middleware
              try {
                const token = await fbUser.getIdToken();
                fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token }),
                }).catch(console.warn);
              } catch (e) {}

              // Get or create Firestore profile
              try {
                const profile = await getUserProfile(fbUser.uid);
                if (profile) {
                  setUser(profile);
                  persistLocalUser(profile);
                } else {
                  const newProfile: UserProfile = {
                    uid: fbUser.uid,
                    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                    username: (fbUser.displayName || fbUser.email?.split('@')[0] || 'user')
                      .toLowerCase()
                      .replace(/\s+/g, '_'),
                    email: fbUser.email || '',
                    photoURL: fbUser.photoURL || undefined,
                    friends: [],
                    createdAt: Date.now(),
                  };
                  await saveUserProfile(newProfile);
                  setUser(newProfile);
                  persistLocalUser(newProfile);
                }
              } catch (e) {
                const fallbackProfile: UserProfile = {
                  uid: fbUser.uid,
                  displayName: fbUser.displayName || 'Firebase User',
                  username: (fbUser.displayName || 'user').toLowerCase().replace(/\s+/g, '_'),
                  email: fbUser.email || '',
                  friends: [],
                  createdAt: Date.now(),
                };
                setUser(fallbackProfile);
                persistLocalUser(fallbackProfile);
              }
            } else {
              // No live firebase user, check local session before booting to login
              const saved = getSavedLocalUser();
              if (saved) {
                setUser(saved);
              } else {
                setUser(null);
              }
            }
            setLoading(false);
          },
          (err) => {
            console.warn('[Firebase Auth listener]', err);
            const saved = getSavedLocalUser();
            setUser(saved || null);
            setLoading(false);
          }
        );

        return () => unsubscribe();
      } catch (err) {
        console.warn('Firebase onAuthStateChanged setup error:', err);
        const saved = getSavedLocalUser();
        setUser(saved || null);
        setLoading(false);
      }
    } else {
      // Offline / standalone mode: restore local session
      const saved = getSavedLocalUser();
      setUser(saved || null);
      setLoading(false);
    }
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    if (isFirebaseConfigured && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const token = await cred.user.getIdToken();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        return;
      } catch (err: any) {
        throw formatFirebaseError(err);
      }
    }

    const updated = mockStore.updateCurrentUser({ email });
    setUser(updated);
    persistLocalUser(updated);
  };

  const signUpWithEmail = async (email: string, pass: string, username: string, displayName: string) => {
    if (isFirebaseConfigured && auth) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName });

        const newProfile: UserProfile = {
          uid: cred.user.uid,
          displayName,
          username: username.toLowerCase().trim(),
          email,
          friends: [],
          createdAt: Date.now(),
        };
        await saveUserProfile(newProfile);
        setUser(newProfile);
        persistLocalUser(newProfile);

        const token = await cred.user.getIdToken();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        return;
      } catch (err: any) {
        throw formatFirebaseError(err);
      }
    }

    const updated = mockStore.updateCurrentUser({
      email,
      username: username.toLowerCase().trim(),
      displayName,
    });
    setUser(updated);
    persistLocalUser(updated);
  };

  const signInWithGoogle = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        const token = await cred.user.getIdToken();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        return;
      } catch (err: any) {
        throw formatFirebaseError(err);
      }
    }

    const updated = mockStore.updateCurrentUser({
      displayName: 'Google Demo User',
      email: 'google_user@demo.com',
    });
    setUser(updated);
    persistLocalUser(updated);
  };

  const signOut = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await fbSignOut(auth);
      } catch (e) {
        console.warn('Firebase signout error:', e);
      }
    }
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(console.warn);
    persistLocalUser(null);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch (e) {}
    }
    setUser(null);
    setFirebaseUser(null);
  };

  const switchUser = (profile: UserProfile) => {
    persistLocalUser(profile);
    mockStore.updateCurrentUser(profile);
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isFirebaseLive,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        switchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
