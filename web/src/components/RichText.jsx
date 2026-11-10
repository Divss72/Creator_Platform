import React from 'react';
import DOMPurify from 'dompurify';

export default function RichText({ html, className = '' }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'b',
      'i',
      'em',
      'strong',
      'a',
      'h1',
      'h2',
      'h3',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'br'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  });

  return <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
