import { Component, type ReactNode } from 'react';

interface State {
  readonly failed: boolean;
}

export class PanelErrorBoundary extends Component<{ readonly children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <p className="panel-error" role="alert">
          Something went wrong in this panel
        </p>
      );
    }
    return this.props.children;
  }
}
