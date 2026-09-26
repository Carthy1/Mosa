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
  user: UserProfile;
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
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirebaseLive = isFirebaseConfigured;

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
                }
              } catch (e) {
                // If firestore read fails (e.g. initial rules), fallback to basic user
                setUser({
                  uid: fbUser.uid,
                  displayName: fbUser.displayName || 'Firebase User',
                  username: (fbUser.displayName || 'user').toLowerCase().replace(/\s+/g, '_'),
                  email: fbUser.email || '',
                  friends: [],
                  createdAt: Date.now(),
                });
              }
            } else {
              setUser(mockStore.getCurrentUser());
            }
            setLoading(false);
          },
          (err) => {
            console.warn('[Firebase Auth listener]', err);
            setUser(mockStore.getCurrentUser());
            setLoading(false);
          }
        );

        return () => unsubscribe();
      } catch (err) {
        console.warn('Firebase onAuthStateChanged setup error:', err);
        setUser(mockStore.getCurrentUser());
        setLoading(false);
      }
    } else {
      setUser(mockStore.getCurrentUser());
      setLoading(false);

      const unsubscribeMock = mockStore.subscribe(() => {
        setUser(mockStore.getCurrentUser());
      });
      return () => unsubscribeMock();
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
  };

  const signOut = async () => {
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
    }
    await fetch('/api/auth/session', { method: 'DELETE' });
    setUser(DEFAULT_USER);
  };

  const switchUser = (profile: UserProfile) => {
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
