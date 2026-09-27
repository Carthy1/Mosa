'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Flame,
  Mail,
  Lock,
  User,
  AtSign,
  LogIn,
  UserPlus,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  Cloud,
  Key,
  ShieldCheck,
} from 'lucide-react';
import { DEMO_FRIENDS, DEFAULT_USER } from '@/lib/mock/mockStore';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const {
    user,
    firebaseUser,
    isFirebaseLive,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    switchUser,
  } = useAuth();

  const activeUser = user || DEFAULT_USER;

  const [mode, setMode] = useState<'signin' | 'signup' | 'config'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        setStatusMessage({ type: 'success', text: 'Signed in successfully!' });
        setTimeout(() => onClose(), 800);
      } else if (mode === 'signup') {
        if (!username || !displayName) {
          throw new Error('Please fill in all profile fields');
        }
        await signUpWithEmail(email, password, username, displayName);
        setStatusMessage({ type: 'success', text: 'Account created and profile saved!' });
        setTimeout(() => onClose(), 800);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Authentication error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setStatusMessage(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
      setStatusMessage({ type: 'success', text: 'Signed in with Google!' });
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Google Auth error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#12121a] border border-white/15 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto scroll-touch p-5 sm:p-6 shadow-2xl flex flex-col text-white animate-in zoom-in-95 cursor-default relative"
      >
        {/* Sticky Header */}
        <div className="sticky -top-5 sm:-top-6 z-30 bg-[#12121a]/95 backdrop-blur-xl pt-1 pb-3 -mt-1 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
              <Flame className="w-5 h-5 text-black fill-black" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Mosa Account & Auth</h2>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isFirebaseLive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-white/60">
                  {isFirebaseLive ? 'Firebase Live Connected' : 'Mock / Standalone Mode'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/80 hover:text-white cursor-pointer transition-transform"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Account Card */}
        <div className="my-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={activeUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt={activeUser.displayName}
              className="w-10 h-10 rounded-full object-cover border border-yellow-400"
            />
            <div>
              <p className="font-bold text-xs text-white truncate">{activeUser.displayName}</p>
              <p className="text-[11px] text-white/50">@{activeUser.username}</p>
            </div>
          </div>

          <button
            onClick={async () => {
              await signOut();
              onClose();
            }}
            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            Sign Out
          </button>
        </div>

        {/* Tabs: Sign In / Create Account / Switch Profile */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-4 border border-white/10">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'signin' ? 'bg-yellow-400 text-black shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'signup' ? 'bg-yellow-400 text-black shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            Create Account
          </button>
          <button
            onClick={() => setMode('config')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'config' ? 'bg-yellow-400 text-black shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            Quick Switch
          </button>
        </div>

        {/* Tab 1 & 2: Sign In / Sign Up Form */}
        {(mode === 'signin' || mode === 'signup') && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="text-[11px] text-white/60 font-semibold mb-1 block">Full Name</label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-white/40 absolute left-3" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. MacCarthy Collins Setor"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-white/60 font-semibold mb-1 block">Unique Handle</label>
                  <div className="relative flex items-center">
                    <AtSign className="w-4 h-4 text-white/40 absolute left-3" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. maccarthy_qa"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[11px] text-white/60 font-semibold mb-1 block">Email Address</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-white/40 absolute left-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-white/60 font-semibold mb-1 block">Password</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-white/40 absolute left-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                  required
                />
              </div>
            </div>

            {statusMessage && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  statusMessage.type === 'error'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {statusMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                'Processing...'
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In with Firebase Auth
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Firebase Account
                </>
              )}
            </button>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>
        )}

        {/* Tab 3: Quick Switch Test Profiles */}
        {mode === 'config' && (
          <div className="space-y-3">
            <p className="text-xs text-white/60">
              Select any demo persona to test two-way chats, direct snaps, and streaks instantly:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  switchUser(DEFAULT_USER);
                  onClose();
                }}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left cursor-pointer transition-all ${
                  activeUser?.uid === DEFAULT_USER.uid
                    ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={DEFAULT_USER.photoURL}
                    alt={DEFAULT_USER.displayName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-bold text-xs">{DEFAULT_USER.displayName}</p>
                    <p className="text-[10px] opacity-60">Lead Engineer & QA</p>
                  </div>
                </div>
                {activeUser?.uid === DEFAULT_USER.uid && <CheckCircle2 className="w-4 h-4 text-yellow-400" />}
              </button>

              {Object.values(DEMO_FRIENDS).map((friend) => (
                <button
                  key={friend.uid}
                  onClick={() => {
                    switchUser(friend);
                    onClose();
                  }}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left cursor-pointer transition-all ${
                    activeUser?.uid === friend.uid
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={friend.photoURL}
                      alt={friend.displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-bold text-xs">{friend.displayName}</p>
                      <p className="text-[10px] opacity-60">@{friend.username}</p>
                    </div>
                  </div>
                  {activeUser?.uid === friend.uid && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Close Button */}
        <div className="mt-5 pt-3 border-t border-white/10 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-98 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            <span>Close Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
