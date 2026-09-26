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
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { DEMO_FRIENDS, DEFAULT_USER } from '@/lib/mock/mockStore';

export function AuthScreen() {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    switchUser,
    isFirebaseLive,
  } = useAuth();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!username.trim() || !displayName.trim()) {
          throw new Error('Please fill in your full name and unique handle');
        }
        await signUpWithEmail(email, password, username, displayName);
        setStatusMessage({ type: 'success', text: 'Account created! Welcome to Mosa.' });
      } else {
        await signInWithEmail(email, password);
        setStatusMessage({ type: 'success', text: 'Signed in successfully! Loading Mosa...' });
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
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Google Auth error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-y-auto bg-black text-white flex flex-col items-center justify-center p-4 scroll-touch select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-gradient-to-tr from-yellow-500/20 via-purple-600/20 to-pink-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md my-auto">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-3xl bg-gradient-to-tr from-yellow-400 via-amber-400 to-yellow-500 items-center justify-center shadow-2xl shadow-yellow-400/30 mb-3 animate-in zoom-in duration-300">
            <Flame className="w-9 h-9 text-black fill-black" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
            Mosa
          </h1>
          <p className="text-sm text-white/60 mt-1 font-medium">
            Ephemeral Social, Disappearing Snaps & Real-Time AR
          </p>
        </div>

        {/* Main Auth Card */}
        <div className="bg-[#12121a]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in duration-300">
          {/* Mode Switch Tabs */}
          <div className="flex rounded-2xl bg-white/5 p-1 mb-6 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setStatusMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setStatusMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Sign In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {/* Full Name */}
                <div>
                  <label className="text-[11px] text-white/70 font-semibold mb-1 block">Full Name</label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-white/40 absolute left-3.5" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. MacCarthy Collins"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Unique Handle */}
                <div>
                  <label className="text-[11px] text-white/70 font-semibold mb-1 block">Unique Handle</label>
                  <div className="relative flex items-center">
                    <AtSign className="w-4 h-4 text-white/40 absolute left-3.5" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. maccarthy"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="text-[11px] text-white/70 font-semibold mb-1 block">Email Address</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-white/40 absolute left-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] text-white/70 font-semibold mb-1 block">Password</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Status Alert */}
            {statusMessage && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
                  statusMessage.type === 'error'
                    ? 'bg-red-500/20 text-red-200 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                }`}
              >
                {statusMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-yellow-400/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                'Processing...'
              ) : mode === 'signup' ? (
                <>
                  <UserPlus className="w-4 h-4 stroke-[2.5]" />
                  Create Mosa Account
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  Sign In
                </>
              )}
            </button>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2.5 active:scale-98 transition-all cursor-pointer"
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

          {/* Quick Demo Personas (For testing) */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={() => setShowDemoProfiles(!showDemoProfiles)}
              className="text-xs text-white/50 hover:text-white/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Or explore as a demo tester</span>
            </button>

            {showDemoProfiles && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-left animate-in fade-in duration-200">
                <button
                  type="button"
                  onClick={() => switchUser(DEFAULT_USER)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <img src={DEFAULT_USER.photoURL} alt={DEFAULT_USER.displayName} className="w-7 h-7 rounded-full object-cover" />
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-bold truncate">{DEFAULT_USER.displayName}</p>
                    <p className="text-[9px] text-white/40">Demo Host</p>
                  </div>
                </button>

                {Object.values(DEMO_FRIENDS).slice(0, 3).map((friend) => (
                  <button
                    key={friend.uid}
                    type="button"
                    onClick={() => switchUser(friend)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <img src={friend.photoURL} alt={friend.displayName} className="w-7 h-7 rounded-full object-cover" />
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold truncate">{friend.displayName}</p>
                      <p className="text-[9px] text-white/40">@{friend.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Security Footer */}
        <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-white/40">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Secured by Firebase Authentication & 24h Ephemeral Cloud Storage</span>
        </div>
      </div>
    </div>
  );
}
