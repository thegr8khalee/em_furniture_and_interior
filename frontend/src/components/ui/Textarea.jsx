const cn = (...classes) => classes.filter(Boolean).join(' ');

const Textarea = ({
  label,
  error,
  hint,
  id,
  className = '',
  wrapperClassName = '',
  required,
  ...props
}) => {
  const textareaId = id || props.name;

  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label ? (
        <label htmlFor={textareaId} className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
          {label} {required ? <span className="text-secondary">*</span> : null}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        className={cn(
          'w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30',
          error && 'border-error focus:border-error focus-visible:ring-error/25',
          className
        )}
        {...props}
      />
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : hint ? <p className="mt-2 text-xs text-neutral/55">{hint}</p> : null}
    </div>
  );
};

export default Textarea;
