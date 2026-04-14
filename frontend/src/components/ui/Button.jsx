import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const variantClasses = {
  elegant: 'btn-elegant',
  'elegant-outline': 'btn-elegant-outline',
  primary: 'btn btn-primary rounded-none shadow-none',
  secondary: 'btn btn-secondary rounded-none shadow-none',
  ghost: 'btn btn-ghost rounded-none shadow-none',
  danger: 'btn btn-error text-white rounded-none shadow-none',
  icon: 'inline-flex items-center justify-center border border-base-300 bg-white text-primary transition-all duration-300 hover:border-secondary hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 rounded-none',
};

const sizeClasses = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-6 text-sm',
  icon: 'h-10 w-10 p-0',
};

const iconSizes = {
  sm: 16,
  md: 18,
  lg: 18,
  icon: 18,
};

const Button = ({
  children,
  variant = 'elegant',
  size = 'md',
  className = '',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  isLoading = false,
  fullWidth = false,
  to,
  href,
  ariaLabel,
  disabled,
  ...props
}) => {
  const classes = cn(
    variantClasses[variant] || variantClasses.elegant,
    variant === 'icon' ? sizeClasses.icon : sizeClasses[size] || sizeClasses.md,
    fullWidth && 'w-full',
    (disabled || isLoading) && 'cursor-not-allowed opacity-70',
    className
  );

  const content = (
    <>
      {isLoading ? <Loader2 size={iconSizes[size] || 18} className="animate-spin" /> : LeftIcon ? <LeftIcon size={iconSizes[size] || 18} /> : null}
      {children ? <span>{children}</span> : null}
      {!isLoading && RightIcon ? <RightIcon size={iconSizes[size] || 18} /> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel} {...props}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} aria-label={ariaLabel} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button
      className={classes}
      aria-label={ariaLabel}
      disabled={disabled || isLoading}
      {...props}
    >
      {content}
    </button>
  );
};

export default Button;
