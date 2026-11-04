'use strict';

const sanitizeHtml = require('sanitize-html');
const ApiError = require('../utils/apiError');

/**
 * Text Safety Service
 * Enforces strict separation between Rich Text (safe HTML) and Plain Text.
 */

const RICH_TEXT_ALLOWED_TAGS = [
  'p', 'br', 'h2', 'h3', 'h4',
  'strong', 'b', 'em', 'i', 'u', 's',
  'blockquote', 'ul', 'ol', 'li',
  'a', 'code', 'pre', 'hr'
];

const RICH_TEXT_OPTIONS = {
  allowedTags: RICH_TEXT_ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto']
  },
  transformTags: {
    a: (tagName, attribs) => {
      return {
        tagName: 'a',
        attribs: {
          href: attribs.href || '',
          rel: 'noopener noreferrer nofollow',
          target: '_blank'
        }
      };
    }
  }
};

// Regex detecting sequences that look like HTML tags or comments:
// e.g. <tag...>, </tag>, <tag/>, <!--...-->
// Allows plain text such as "I <3 this" and "a < b > c"
const HTML_LIKE_REGEX = /<(?:\/?[a-zA-Z][^\s>]*(\s+[^>]*)?|!--[\s\S]*?--)>/i;

// Bidi-override, formatting control, and zero-width characters:
// \u202A-\u202E (LRE, RLE, PDF, LRO, RLO)
// \u2066-\u2069 (LRI, RLI, FSI, PDI)
// \u200E, \u200F (LRM, RLM)
// \u200B-\u200D (ZWSP, ZWNJ, ZWJ)
// \uFEFF (BOM / ZWNBSP)
const INVISIBLE_AND_BIDI_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

// Control characters (excluding \r and \n)
const CONTROL_CHARS_PRESERVE_NEWLINES = /[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g;
// All control characters
const CONTROL_CHARS_ALL = /[\x00-\x1F\x7F]/g;

/**
 * Sanitizes rich text HTML for post bodies.
 * Raw input maximum length: 100,000 characters.
 * Guarantees idempotency: sanitize(sanitize(x)) === sanitize(x).
 */
function sanitizeRichText(input, maxLength = 100000) {
  if (typeof input !== 'string') {
    throw ApiError.validation('Content body must be a string');
  }

  if (input.length > maxLength) {
    throw ApiError.validation(`Content body exceeds maximum length of ${maxLength} characters`);
  }

  // Sanitize with strict allow-list
  const clean = sanitizeHtml(input, RICH_TEXT_OPTIONS);
  return clean;
}

/**
 * Cleans plain-text fields (title, comments, names, bio, original_name).
 * Rejects with VALIDATION_ERROR if the string looks like HTML.
 */
function cleanPlainText(input, { maxLength, fieldName = 'Field', allowNewlines = false } = {}) {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input !== 'string') {
    throw ApiError.validation(`${fieldName} must be a string`);
  }

  // 1. Unicode NFC normalization
  let cleaned = input.normalize('NFC');

  // 2. Remove bidi-override and zero-width characters
  cleaned = cleaned.replace(INVISIBLE_AND_BIDI_REGEX, '');

  // 3. Remove control characters (conditionally keeping newlines)
  if (allowNewlines) {
    cleaned = cleaned.replace(CONTROL_CHARS_PRESERVE_NEWLINES, '');
  } else {
    cleaned = cleaned.replace(CONTROL_CHARS_ALL, '');
  }

  // 4. Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  // 5. Reject HTML-like tag sequences
  if (HTML_LIKE_REGEX.test(cleaned)) {
    throw ApiError.validation('HTML is not allowed here');
  }

  // 6. Enforce length
  if (maxLength && cleaned.length > maxLength) {
    throw ApiError.validation(`${fieldName} must not exceed ${maxLength} characters`);
  }

  return cleaned;
}

/**
 * Checks whether a plain text input contains tag-like sequences without cleaning.
 */
function containsHtmlTag(input) {
  if (typeof input !== 'string') return false;
  return HTML_LIKE_REGEX.test(input);
}

/**
 * Generates a clean plain-text excerpt from rich HTML.
 * Strips all tags, decodes entities, collapses whitespace, cuts at word boundary ~200 chars.
 * Replaces any remaining '<' with full-width '＜'.
 */
function generatePlainTextExcerpt(richHtml, maxLength = 200) {
  if (!richHtml || typeof richHtml !== 'string') {
    return '';
  }

  // 1. Strip all HTML tags
  const stripped = sanitizeHtml(richHtml, {
    allowedTags: [],
    allowedAttributes: {}
  });

  // 2. Decode standard HTML entities
  const decoded = stripped
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // 3. Collapse whitespace
  const collapsed = decoded.replace(/\s+/g, ' ').trim();

  if (!collapsed) {
    return '';
  }

  // 4. Truncate at word boundary around maxLength
  let truncated = collapsed;
  if (collapsed.length > maxLength) {
    const boundary = collapsed.lastIndexOf(' ', maxLength);
    truncated = (boundary > 0 ? collapsed.slice(0, boundary) : collapsed.slice(0, maxLength)) + '...';
  }

  // 5. If truncated still looks like it has a tag, replace '<' with full-width '＜'
  if (truncated.includes('<')) {
    truncated = truncated.replace(/</g, '＜');
  }

  return truncated;
}

module.exports = {
  sanitizeRichText,
  cleanPlainText,
  containsHtmlTag,
  generatePlainTextExcerpt,
  RICH_TEXT_ALLOWED_TAGS
};
