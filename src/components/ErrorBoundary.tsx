'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; path?: string };
      if (parsed.error) {
        readable = `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
      }
    } catch {
      // keep raw message
    }
    return {
      hasError: true,
      errorMessage: readable || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('TripGenie ErrorBoundary caught error:', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-xl font-bold font-display text-[#0B1D3A]">
                Something interrupted your session
              </h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B1D3A] text-white text-sm font-medium hover:bg-[#132F5E] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Recover View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
