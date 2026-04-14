import Button from './Button';

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  className = '',
}) => {
  return (
    <div className={`border border-base-300 bg-white px-6 py-14 text-center ${className}`}>
      {Icon ? <Icon size={60} className="mx-auto mb-4 text-neutral/30" /> : null}
      <h3 className="font-heading text-2xl font-semibold text-neutral">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-neutral/60">{description}</p> : null}
      {actionLabel ? (
        <div className="mt-6 flex justify-center">
          <Button to={actionTo} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default EmptyState;
