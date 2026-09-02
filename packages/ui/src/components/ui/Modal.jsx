import { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, children, className = '' }) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className={`w-full max-w-2xl border border-base-300 bg-white p-6 shadow-2xl ${className}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title || 'Modal'}>
        {title ? <h2 className="mb-4 font-heading text-2xl font-semibold text-neutral">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
};

export default Modal;
