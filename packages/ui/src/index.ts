export {
  Button,
  Disclosure,
  EmptyState,
  ErrorMessage,
  FormField,
  LoadingIndicator,
  PermissionRequest,
  ProgressIndicator,
  SegmentedControl,
  StatusCard,
  WarningMessage,
} from './components';

export type {
  ButtonProps,
  ButtonVariant,
  DisclosureProps,
  EmptyStateProps,
  FormFieldProps,
  LoadingIndicatorProps,
  PermissionRequestProps,
  ProgressIndicatorProps,
  SegmentedControlProps,
  StatusCardProps,
  StatusTone,
} from './components';

export const uiTokens = {
  colors: {
    ink: '#172033',
    muted: '#5d6b82',
    accent: '#285fd1',
    background: '#f5f7fb',
    surface: '#ffffff',
    border: '#d5ddea',
    success: '#087443',
    warning: '#8a5a00',
    danger: '#b42318',
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
  },
  radii: {
    small: '8px',
    medium: '12px',
    large: '16px',
  },
  motion: {
    fast: '120ms',
  },
} as const;
