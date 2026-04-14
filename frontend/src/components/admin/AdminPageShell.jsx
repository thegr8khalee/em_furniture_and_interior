const AdminPageShell = ({ title, subtitle, actions, children }) => {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-neutral lg:text-3xl">{title}</h1>
          <span className="mt-2 block h-0.5 w-12 bg-secondary" />
          {subtitle && <p className="mt-1 text-sm text-neutral/50">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* Content */}
      {children}
    </div>
  );
};

export default AdminPageShell;
