'use client';
import React, { useEffect } from 'react';
import { catchError, type ErrorInfo } from 'next/error';
import { reportClientError } from '@/lib/client-error-report';

export interface ResilientWidgetBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  widgetName?: string;
}
export interface ResilientWidgetBoundaryState {
  hasError: boolean;
  error?: Error;
}
function reportWidgetFailure(error: Error) {
  try {
    reportClientError(error, window.location.pathname);
  } catch {
    /* Reporting is optional. */
  }
}
function WidgetFailure(
  { fallback }: Omit<ResilientWidgetBoundaryProps, 'children'>,
  { error }: ErrorInfo,
) {
  useEffect(() => {
    reportWidgetFailure(error);
  }, [error]);
  return fallback ?? null;
}
// Framework-aware isolation also catches rejected RSC children during streaming.
const StreamBoundary = catchError(WidgetFailure);

export class ResilientWidgetBoundary extends React.Component<
  ResilientWidgetBoundaryProps,
  ResilientWidgetBoundaryState
> {
  state: ResilientWidgetBoundaryState = { hasError: false };
  static getDerivedStateFromError(error: Error): ResilientWidgetBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    reportWidgetFailure(error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return (
      <StreamBoundary fallback={this.props.fallback} widgetName={this.props.widgetName}>
        {this.props.children}
      </StreamBoundary>
    );
  }
}
