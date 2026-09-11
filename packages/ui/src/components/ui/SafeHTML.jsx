import React from 'react';
import DOMPurify from 'dompurify';

/**
 * Renders sanitized HTML safely to prevent Stored / Reflected XSS attacks.
 * Uses DOMPurify to strip malicious scripts, handlers (onerror, onload),
 * and disallowed attributes.
 */
export default function SafeHTML({ html, className = '', as: Component = 'div', ...props }) {
  if (!html && html !== 0) return null;
  const clean = DOMPurify.sanitize(String(html));
  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
      {...props}
    />
  );
}
