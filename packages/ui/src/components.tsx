import type {
  ButtonHTMLAttributes,
  DetailsHTMLAttributes,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from 'react';

function classes(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classes(
        'ui-button',
        `ui-button--${variant}`,
        fullWidth && 'ui-button--full',
        className,
      )}
    />
  );
}

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  tone?: StatusTone;
  children?: ReactNode;
}

export function StatusCard({
  title,
  description,
  meta,
  tone = 'neutral',
  className,
  children,
  ...props
}: StatusCardProps) {
  return (
    <section {...props} className={classes('ui-status-card', className)} data-tone={tone}>
      <p className="ui-status-card__title">{title}</p>
      {description && <p className="ui-status-card__description">{description}</p>}
      {meta && <p className="ui-status-card__meta">{meta}</p>}
      {children && <div className="ui-status-card__content">{children}</div>}
    </section>
  );
}

export function ErrorMessage(props: Omit<StatusCardProps, 'tone'>) {
  return <StatusCard {...props} tone="danger" role={props.role ?? 'alert'} />;
}

export function WarningMessage(props: Omit<StatusCardProps, 'tone'>) {
  return <StatusCard {...props} tone="warning" />;
}

export interface SegmentedControlProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
}

export function SegmentedControl({ label, className, ...props }: SegmentedControlProps) {
  return (
    <div
      {...props}
      className={classes('ui-segmented-control', className)}
      role="group"
      aria-label={label}
    />
  );
}

export interface ProgressIndicatorProps extends HTMLAttributes<HTMLElement> {
  label: ReactNode;
  value: number;
  max?: number;
  valueLabel?: ReactNode;
  details?: ReactNode;
}

export function ProgressIndicator({
  label,
  value,
  max = 100,
  valueLabel,
  details,
  className,
  ...props
}: ProgressIndicatorProps) {
  return (
    <section {...props} className={classes('ui-progress', className)}>
      <div className="ui-progress__header">
        <strong>{label}</strong>
        <span>{valueLabel ?? `${value}%`}</span>
      </div>
      <progress
        max={max}
        value={value}
        aria-label={typeof label === 'string' ? label : undefined}
      />
      {details && <div className="ui-progress__details">{details}</div>}
    </section>
  );
}

export interface PermissionRequestProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}

export function PermissionRequest({
  title = 'Site access needed',
  description,
  actions,
  className,
  ...props
}: PermissionRequestProps) {
  return (
    <section {...props} className={classes('ui-permission-request', className)}>
      <span className="ui-permission-request__icon" aria-hidden="true">
        ◇
      </span>
      <div>
        <p className="ui-permission-request__title">{title}</p>
        <p className="ui-permission-request__description">{description}</p>
      </div>
      {actions && <div className="ui-permission-request__actions">{actions}</div>}
    </section>
  );
}

export interface EmptyStateProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function EmptyState({ className, ...props }: EmptyStateProps) {
  return <section {...props} className={classes('ui-empty-state', className)} />;
}

export interface DisclosureProps extends DetailsHTMLAttributes<HTMLDetailsElement> {
  label: ReactNode;
  children: ReactNode;
}

export function Disclosure({ label, children, className, ...props }: DisclosureProps) {
  return (
    <details {...props} className={classes('ui-disclosure', className)}>
      <summary>{label}</summary>
      <div className="ui-disclosure__content">{children}</div>
    </details>
  );
}

export interface LoadingIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function LoadingIndicator({ className, ...props }: LoadingIndicatorProps) {
  return (
    <span
      {...props}
      className={classes('ui-loading-indicator', className)}
      role={props.role ?? 'status'}
    />
  );
}

export interface FormFieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

export function FormField({ label, hint, children, className, ...props }: FormFieldProps) {
  return (
    <label {...props} className={classes('ui-field', className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="ui-field__hint">{hint}</span>}
    </label>
  );
}
