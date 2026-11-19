import { engine } from '@/services/engine';
import type { FrontendErrorSource } from '@/services/bindings/FrontendErrorSource';

/** Sends a UI error to the engine log. Reporting is best-effort and must never throw. */
export function reportFrontendError(source: FrontendErrorSource, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[${source}]`, err);
  if (!engine.isAvailable()) return;
  engine
    .reportFrontendError({ source, message: err.message, stack: err.stack })
    .catch((reportFailure: unknown) => {
      console.error('Could not deliver the error report to the engine.', reportFailure);
    });
}

/** Routes uncaught errors and unhandled promise rejections into the engine log. */
export function installGlobalErrorReporting(): () => void {
  const onError = (event: ErrorEvent) =>
    reportFrontendError('window-error', event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) =>
    reportFrontendError('unhandled-rejection', event.reason);

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
