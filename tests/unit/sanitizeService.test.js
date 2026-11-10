'use strict';

const {
  sanitizeRichText,
  cleanPlainText,
  containsHtmlTag,
  generatePlainTextExcerpt,
  RICH_TEXT_ALLOWED_TAGS
} = require('../../src/services/sanitizeService');

describe('Unit: sanitizeService', () => {
  // =========================================================================
  // 1. sanitizeRichText: XSS Attack Corpus
  // =========================================================================
  describe('sanitizeRichText: XSS Attack Corpus', () => {
    test('strips <script> tags and inner code completely', () => {
      const malicious = '<p>Normal</p><script>alert("XSS")</script>';
      const clean = sanitizeRichText(malicious);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('alert');
      expect(clean).toContain('<p>Normal</p>');
    });

    test('strips <img> tags and onerror handlers', () => {
      const malicious = '<img src="invalid.jpg" onerror="alert(1)">';
      const clean = sanitizeRichText(malicious);
      expect(clean).toBe('');
    });

    test('strips <svg> and onload handlers', () => {
      const malicious = '<svg onload="alert(document.cookie)">';
      const clean = sanitizeRichText(malicious);
      expect(clean).toBe('');
    });

    test('strips <iframe> tags', () => {
      const malicious = '<iframe src="https://attacker.site"></iframe>';
      const clean = sanitizeRichText(malicious);
      expect(clean).toBe('');
    });

    test('strips <style> tags and inline css expressions', () => {
      const malicious = '<style>body { background: red; }</style><p>Hello</p>';
      const clean = sanitizeRichText(malicious);
      expect(clean).not.toContain('<style');
      expect(clean).toContain('<p>Hello</p>');
    });

    test('strips javascript: and data: pseudo-protocols on <a> tags', () => {
      const jsLink = '<a href="javascript:alert(1)">Click Me</a>';
      const dataLink =
        '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click Me</a>';

      expect(sanitizeRichText(jsLink)).not.toContain('javascript:');
      expect(sanitizeRichText(dataLink)).not.toContain('data:');
    });

    test('strips entity-encoded javascript: scheme on links', () => {
      const encoded =
        '<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)">Click</a>';
      const clean = sanitizeRichText(encoded);
      expect(clean).not.toContain('javascript');
      expect(clean).not.toContain('alert');
    });

    test('strips nested and broken tags', () => {
      const broken = '<<SCRIPT>alert("XSS");//<</SCRIPT>';
      const clean = sanitizeRichText(broken);
      expect(clean).not.toContain('<SCRIPT');
      expect(clean).not.toContain('alert');
    });

    test('strips inline event handler attributes (onclick, onmouseover, etc.)', () => {
      const element = '<p onclick="alert(1)" onmouseover="steal()">Safe Paragraph</p>';
      const clean = sanitizeRichText(element);
      expect(clean).toBe('<p>Safe Paragraph</p>');
    });

    test('strips disallowed style attributes', () => {
      const styled = '<p style="color: red; position: fixed;">Text</p>';
      const clean = sanitizeRichText(styled);
      expect(clean).toBe('<p>Text</p>');
    });

    test('strips <form> and <input> tags', () => {
      const form = '<form action="/steal"><input type="password" name="pw"/></form>';
      const clean = sanitizeRichText(form);
      expect(clean).toBe('');
    });
  });

  // =========================================================================
  // 2. sanitizeRichText: Allowed Formatting & Idempotence
  // =========================================================================
  describe('sanitizeRichText: Allowed Formatting & Features', () => {
    test('preserves allowed rich-text tags', () => {
      const allowed =
        '<h2>Heading</h2><p>Paragraph with <strong>bold</strong>, <em>italic</em>, <code>code</code>.</p>' +
        '<blockquote>Quote</blockquote><ul><li>Item 1</li><li>Item 2</li></ul><hr />';
      const clean = sanitizeRichText(allowed);
      expect(clean).toContain('<h2>Heading</h2>');
      expect(clean).toContain('<strong>bold</strong>');
      expect(clean).toContain('<em>italic</em>');
      expect(clean).toContain('<code>code</code>');
      expect(clean).toContain('<blockquote>Quote</blockquote>');
      expect(clean).toContain('<ul><li>Item 1</li><li>Item 2</li></ul>');
    });

    test('enforces rel="noopener noreferrer nofollow" and target="_blank" on external links', () => {
      const link = '<a href="https://example.com/guide">External Guide</a>';
      const clean = sanitizeRichText(link);
      expect(clean).toContain('rel="noopener noreferrer nofollow"');
      expect(clean).toContain('target="_blank"');
      expect(clean).toContain('href="https://example.com/guide"');
    });

    test('is strictly idempotent: sanitize(sanitize(x)) === sanitize(x)', () => {
      const input =
        '<p>Check out <a href="https://site.org">this link</a> & <strong>bold text</strong></p>';
      const pass1 = sanitizeRichText(input);
      const pass2 = sanitizeRichText(pass1);
      const pass3 = sanitizeRichText(pass2);
      expect(pass2).toBe(pass1);
      expect(pass3).toBe(pass1);
    });

    test('throws validation error if input exceeds maxLength or is not string', () => {
      expect(() => sanitizeRichText(123)).toThrow('Content body must be a string');
      expect(() => sanitizeRichText('a'.repeat(101), 100)).toThrow('exceeds maximum length');
    });
  });

  // =========================================================================
  // 3. cleanPlainText
  // =========================================================================
  describe('cleanPlainText: Plain Text Sanitisation', () => {
    test('rejects inputs containing HTML tag sequences with 400 VALIDATION_ERROR', () => {
      expect(() => cleanPlainText('<script>alert(1)</script>')).toThrow('HTML is not allowed here');
      expect(() => cleanPlainText('Title with <p>tag</p>')).toThrow('HTML is not allowed here');
      expect(() => cleanPlainText('Title with <b/>')).toThrow('HTML is not allowed here');
      expect(() => cleanPlainText('<!-- comment -->')).toThrow('HTML is not allowed here');
    });

    test('preserves math and emoticons: "I <3 this" and "a < b > c"', () => {
      expect(cleanPlainText('I <3 this')).toBe('I <3 this');
      expect(cleanPlainText('a < b > c')).toBe('a < b > c');
      expect(cleanPlainText('5 < 10 and 20 > 15')).toBe('5 < 10 and 20 > 15');
      expect(cleanPlainText('Hello :) <3')).toBe('Hello :) <3');
    });

    test('normalizes Unicode into NFC form', () => {
      // Decomposed é (\u0065\u0301) normalizes to precomposed é (\u00E9)
      const decomposed = 'cafe\u0301';
      const normalized = cleanPlainText(decomposed);
      expect(normalized).toBe('café');
      expect(normalized.length).toBe(4);
    });

    test('strips bidi-override and zero-width invisible characters', () => {
      // \u202E is Right-to-Left Override, \u200B is Zero-Width Space
      const attack = 'Admin\u202E\u200BUser';
      const clean = cleanPlainText(attack);
      expect(clean).toBe('AdminUser');
    });

    test('strips control characters', () => {
      const text = 'Hello\x00\x08World\x1F!';
      const clean = cleanPlainText(text);
      expect(clean).toBe('HelloWorld!');
    });

    test('preserves newlines when allowNewlines=true', () => {
      const multiline = 'Line 1\nLine 2\r\nLine 3';
      const clean = cleanPlainText(multiline, { allowNewlines: true });
      expect(clean).toBe('Line 1\nLine 2\r\nLine 3');
    });

    test('enforces maxLength constraint', () => {
      expect(() => cleanPlainText('123456', { maxLength: 5, fieldName: 'Title' })).toThrow(
        'Title must not exceed 5 characters'
      );
    });
  });

  // =========================================================================
  // 4. generatePlainTextExcerpt
  // =========================================================================
  describe('generatePlainTextExcerpt', () => {
    test('extracts clean plain text from rich HTML', () => {
      const html =
        '<h2>Title</h2> <p>This is a <strong>rich</strong> text snippet with <a href="#">links</a>.</p>';
      const excerpt = generatePlainTextExcerpt(html, 100);
      expect(excerpt).toBe('Title This is a rich text snippet with links.');
    });

    test('collapses whitespace and decodes HTML entities', () => {
      const html = '<p>First &amp; Second&nbsp;&nbsp;&nbsp;Third &lt;tag&gt; &#39;quotes&#39;</p>';
      const excerpt = generatePlainTextExcerpt(html, 100);
      expect(excerpt).toContain("First & Second Third ＜tag> 'quotes'");
    });

    test('truncates at word boundary with ellipsis', () => {
      const html =
        '<p>The quick brown fox jumps over the lazy dog and runs across the entire meadow.</p>';
      const excerpt = generatePlainTextExcerpt(html, 30);
      expect(excerpt.endsWith('...')).toBe(true);
      expect(excerpt.length).toBeLessThanOrEqual(35);
    });

    test('replaces any leftover "<" with full-width "＜" for safety', () => {
      const html = '<p>Value is < 50</p>';
      const excerpt = generatePlainTextExcerpt(html, 50);
      expect(excerpt).not.toContain('<');
      expect(excerpt).toContain('＜');
    });

    test('returns empty string for null or empty input', () => {
      expect(generatePlainTextExcerpt(null)).toBe('');
      expect(generatePlainTextExcerpt('')).toBe('');
      expect(generatePlainTextExcerpt('<p>   </p>')).toBe('');
    });
  });
});
