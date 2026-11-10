'use strict';

const env = require('../../../config/env');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanSubject(str) {
  return String(str || '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 150);
}

/**
 * Render welcome email for a new subscriber.
 * @param {Object} params
 * @param {string} params.subscriberName
 * @param {string} params.creatorName
 * @param {string} params.tierName
 * @param {string} params.unsubscribeUrl
 * @returns {{ subject: string, html: string, text: string, headers: Object }}
 */
function renderWelcomeEmail({ subscriberName, creatorName, tierName, unsubscribeUrl }) {
  const safeSubName = escapeHtml(subscriberName || 'Subscriber');
  const safeCreatorName = escapeHtml(creatorName || 'Creator');
  const safeTier = escapeHtml((tierName || 'free').toUpperCase());
  const safeUnsub = escapeHtml(unsubscribeUrl);

  const subject = cleanSubject(
    `Welcome to ${creatorName || 'Creator'}'s ${safeTier} Tier on CreatorHub!`
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px; background: #fff; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #0969da; color: #fff; font-size: 12px; font-weight: bold; }
    .footer { margin-top: 32px; font-size: 12px; color: #6e7781; border-top: 1px solid #e1e4e8; padding-top: 16px; }
    a { color: #0969da; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Welcome to the community, ${safeSubName}!</h2>
    <p>You have successfully subscribed to <strong>${safeCreatorName}</strong> at the <span class="badge">${safeTier}</span> tier.</p>
    <p>You now have immediate access to exclusive posts, community discussions, and live chat.</p>
    <div class="footer">
      <p>Sent by CreatorHub. To manage your notification preferences or unsubscribe, <a href="${safeUnsub}">click here</a>.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Welcome to the community, ${subscriberName || 'Subscriber'}!

You have successfully subscribed to ${creatorName || 'Creator'} at the ${(tierName || 'free').toUpperCase()} tier.
You now have immediate access to exclusive posts, community discussions, and live chat.

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
  renderWelcomeEmail,
  escapeHtml,
  cleanSubject
};
