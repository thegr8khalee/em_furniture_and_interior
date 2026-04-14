const cn = (...classes) => classes.filter(Boolean).join(' ');

const Select = ({
  label,
  error,
  hint,
  id,
  className = '',
  wrapperClassName = '',
  children,
  required,
  ...props
}) => {
  const selectId = id || props.name;

  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label ? (
        <label htmlFor={selectId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
          {label} {required ? <span className="text-secondary">*</span> : null}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          'w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30',
          error && 'border-error focus:border-error focus-visible:ring-error/25',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : hint ? <p className="mt-2 text-xs text-neutral/55">{hint}</p> : null}
    </div>
  );
};

export default Select;
