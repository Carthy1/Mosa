'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Mosa Error Boundary caught error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center select-none">
          <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-xs text-white/60 max-w-sm mb-6">
            Mosa caught an unexpected UI error and prevented the page from crashing.
          </p>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-full hover:bg-yellow-300 active:scale-95 transition-all cursor-pointer flex items-center gap-2 shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload App</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
