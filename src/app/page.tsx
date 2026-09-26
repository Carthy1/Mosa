'use client';

import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';

const SwipeContainer = dynamic(
  () => import('@/components/navigation/SwipeContainer').then((mod) => mod.SwipeContainer),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin mb-4" />
        <h2 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
          Mosa
        </h2>
        <p className="text-xs text-white/50 mt-1">Initializing 3-Pane Web AR Engine...</p>
      </div>
    ),
  }
);

function AppRoot() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white select-none">
        <div className="w-16 h-16 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin mb-4" />
        <h2 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
          Mosa
        </h2>
        <p className="text-xs text-white/50 mt-1 font-medium">Checking session...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-black">
      <SwipeContainer />
    </main>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
