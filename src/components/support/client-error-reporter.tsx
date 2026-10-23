'use client';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-report';
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (event.error instanceof Error) reportClientError(event.error, window.location.pathname);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error) reportClientError(event.reason, window.location.pathname);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
