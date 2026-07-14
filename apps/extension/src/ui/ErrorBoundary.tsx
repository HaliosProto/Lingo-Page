import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n/messages';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('extension_ui_error', { name: error.name, componentStack: info.componentStack });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="error-shell" role="alert">
          <h1>{t('productName')}</h1>
          <p>{t('unexpectedError')}</p>
        </main>
      );
    }
    return this.props.children;
  }
}
