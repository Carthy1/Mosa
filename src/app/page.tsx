'use client';

import dynamic from 'next/dynamic';
import { AuthProvider } from '@/context/AuthContext';

const SwipeContainer = dynamic(
  () => import('@/components/navigation/SwipeContainer').then((mod) => mod.SwipeContainer),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin mb-4" />
        <h2 className="text-xl font-black tracking-tight">AuraSnap</h2>
        <p className="text-xs text-white/50 mt-1">Initializing 3-Pane Web AR Engine...</p>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <AuthProvider>
      <main className="w-screen h-screen overflow-hidden bg-black">
        <SwipeContainer />
      </main>
    </AuthProvider>
  );
}
