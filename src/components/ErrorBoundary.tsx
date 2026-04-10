'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? 'An error occurred.' };
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>{this.state.message}</span>
            <button
              onClick={this.reset}
              className="shrink-0 text-red-400 hover:text-red-600 font-medium"
            >
              Retry
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
