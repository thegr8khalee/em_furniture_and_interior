const badgeClasses = {
  neutral: 'border-base-300 bg-base-200 text-neutral',
  primary: 'border-primary/20 bg-primary/10 text-primary',
  secondary: 'border-secondary/20 bg-secondary/15 text-primary',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  error: 'border-error/20 bg-error/10 text-error',
  info: 'border-info/20 bg-info/10 text-info',
};

const statusToVariant = {
  pending: 'warning',
  confirmed: 'primary',
  processing: 'secondary',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'error',
  refunded: 'error',
  paid: 'success',
  failed: 'error',
  unread: 'primary',
  read: 'neutral',
};

const Badge = ({ children, variant, status, className = '' }) => {
  const resolvedVariant = variant || statusToVariant[String(status || '').toLowerCase()] || 'neutral';
  return (
    <span className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${badgeClasses[resolvedVariant]} ${className}`}>
      {children || status}
    </span>
  );
};

export default Badge;
