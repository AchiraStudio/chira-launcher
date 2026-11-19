import { TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Surface } from '@/design-system';
import { reportFrontendError } from './errorReporting';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence for the UI. A render crash must not leave a blank window: it is logged
 * through the engine and the user can reload the interface. The engine — and any apps it
 * manages — keep running (plan §4.1).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    reportFrontendError('error-boundary', error);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid h-full place-items-center p-8">
        <Surface material="solid" className="max-w-md space-y-4 p-8" role="alert">
          <TriangleAlert className="text-warning" size={28} aria-hidden />
          <h1 className="text-xl font-extrabold">The interface hit a problem</h1>
          <p className="selectable text-sm text-muted">{this.state.error.message}</p>
          <p className="text-sm text-muted">
            This was written to the log. Your apps are unaffected — only the interface needs a
            restart.
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload interface
          </Button>
        </Surface>
      </div>
    );
  }
}
