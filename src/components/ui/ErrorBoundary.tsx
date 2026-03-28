"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportError } from "@/lib/error-reporter";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global ErrorBoundary — catches unhandled JS errors in dashboard.
 * Shows a branded error card with "Reload" button instead of white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[SOVEREIGN ErrorBoundary]:", error, errorInfo);
    reportError(error, `ErrorBoundary — ${errorInfo.componentStack?.slice(0, 200) ?? "no stack"}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <div className="max-w-md w-full glass-card border border-rose-500/20 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {this.props.fallbackTitle || "Something went wrong"}
            </h2>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              An unexpected error occurred. This has been logged and our team will investigate.
            </p>
            {this.state.error && (
              <div className="bg-black/40 border border-rose-500/10 rounded-lg p-3 mb-6 text-left">
                <p className="text-[10px] uppercase tracking-widest text-rose-400/60 mb-1 font-bold">Error Details</p>
                <p className="text-xs text-neutral-500 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-gpu"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
