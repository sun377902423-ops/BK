import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback error={this.state.error} onReset={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

const ErrorFallback: React.FC<{ error: Error | null; onReset: () => void }> = ({ error, onReset }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <ExclamationTriangleIcon className="w-16 h-16 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('common.error')}</h2>
      <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
        {error?.message || t('common.unknownError')}
      </p>
      <button onClick={onReset} className="btn-primary">
        {t('common.retry')}
      </button>
    </div>
  );
};

export default ErrorBoundary;
