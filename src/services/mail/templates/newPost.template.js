'use strict';

const { escapeHtml, cleanSubject } = require('./welcome.template');

/**
 * Render new post notification email.
 * Hard rule: Never leak post body HTML or media URLs.
 *
 * @param {Object} params
 * @param {string} params.subscriberName
 * @param {string} params.creatorName
 * @param {string} params.postTitle
 * @param {string} params.postExcerpt
 * @param {string} params.postUrl
 * @param {string} params.unsubscribeUrl
 * @returns {{ subject: string, html: string, text: string, headers: Object }}
 */
function renderNewPostEmail({
  subscriberName,
  creatorName,
  postTitle,
  postExcerpt,
  postUrl,
  unsubscribeUrl
}) {
  const safeSubName = escapeHtml(subscriberName || 'Subscriber');
  const safeCreatorName = escapeHtml(creatorName || 'Creator');
  const safePostTitle = escapeHtml(postTitle || 'Untitled Post');
  const safeExcerpt = escapeHtml(postExcerpt || '');
  const safePostUrl = escapeHtml(postUrl);
  const safeUnsub = escapeHtml(unsubscribeUrl);

  const subject = cleanSubject(
    `New post from ${creatorName || 'Creator'}: ${postTitle || 'Untitled'}`
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px; background: #fff; }
    .btn { display: inline-block; padding: 10px 18px; border-radius: 6px; background: #0969da; color: #fff; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .excerpt { background: #f6f8fa; border-left: 4px solid #0969da; padding: 12px 16px; margin: 16px 0; color: #57606a; font-style: italic; }
    .footer { margin-top: 32px; font-size: 12px; color: #6e7781; border-top: 1px solid #e1e4e8; padding-top: 16px; }
    a { color: #0969da; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Hi ${safeSubName},</h2>
    <p><strong>${safeCreatorName}</strong> just published a new post:</p>
    <h3>${safePostTitle}</h3>
    ${safeExcerpt ? `<div class="excerpt">${safeExcerpt}</div>` : ''}
    <div>
      <a href="${safePostUrl}" class="btn" style="color: #ffffff;">Read on CreatorHub &rarr;</a>
    </div>
    <div class="footer">
      <p>Sent by CreatorHub. To manage your notification preferences or unsubscribe, <a href="${safeUnsub}">click here</a>.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hi ${subscriberName || 'Subscriber'},

${creatorName || 'Creator'} just published a new post:

${postTitle || 'Untitled'}

${postExcerpt ? `"${postExcerpt}"\n` : ''}
Read full post on CreatorHub: ${postUrl}

---
Sent by CreatorHub.
To manage your notification preferences or unsubscribe: ${unsubscribeUrl}
`;

  return {
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}

module.exports = {
  renderNewPostEmail
};
