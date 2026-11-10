'use strict';

const { escapeHtml, cleanSubject } = require('./welcome.template');

/**
 * Render weekly digest email.
 *
 * @param {Object} params
 * @param {string} params.subscriberName
 * @param {string} params.weekRange
 * @param {Array<{ creatorName: string, posts: Array<{ title: string, url: string, minTier: string }> }>} params.creatorsWithPosts
 * @param {string} params.unsubscribeUrl
 * @returns {{ subject: string, html: string, text: string, headers: Object }}
 */
function renderDigestEmail({ subscriberName, weekRange, creatorsWithPosts, unsubscribeUrl }) {
  const safeSubName = escapeHtml(subscriberName || 'Subscriber');
  const safeWeek = escapeHtml(weekRange || 'this week');
  const safeUnsub = escapeHtml(unsubscribeUrl);

  const subject = cleanSubject(`Your CreatorHub Weekly Digest (${weekRange || 'This Week'})`);

  let htmlContent = '';
  let textContent = '';

  for (const group of creatorsWithPosts || []) {
    const safeCreator = escapeHtml(group.creatorName);
    htmlContent += `<div style="margin-top: 24px;">\n`;
    htmlContent += `  <h3 style="color: #0969da; border-bottom: 1px solid #e1e4e8; padding-bottom: 6px;">${safeCreator}</h3>\n`;
    htmlContent += `  <ul style="padding-left: 20px;">\n`;

    textContent += `\n--- ${group.creatorName} ---\n`;

    for (const post of group.posts || []) {
      const safeTitle = escapeHtml(post.title);
      const safeUrl = escapeHtml(post.url);
      const safeTier = escapeHtml((post.minTier || 'free').toUpperCase());
      htmlContent += `    <li style="margin-bottom: 8px;"><a href="${safeUrl}"><strong>${safeTitle}</strong></a> <span style="font-size: 11px; background: #eee; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${safeTier}</span></li>\n`;

      textContent += `* ${post.title} [${(post.minTier || 'free').toUpperCase()}]: ${post.url}\n`;
    }

    htmlContent += `  </ul>\n</div>\n`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px; background: #fff; }
    .footer { margin-top: 32px; font-size: 12px; color: #6e7781; border-top: 1px solid #e1e4e8; padding-top: 16px; }
    a { color: #0969da; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Your Weekly Digest</h2>
    <p>Hi ${safeSubName}, here is the latest content from creators you follow (${safeWeek}):</p>
    ${htmlContent || '<p>No new posts this week.</p>'}
    <div class="footer">
      <p>Sent by CreatorHub. To manage your notification preferences or unsubscribe, <a href="${safeUnsub}">click here</a>.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Your Weekly Digest (${weekRange || 'This Week'})

Hi ${subscriberName || 'Subscriber'}, here is the latest content from creators you follow:
${textContent || '\nNo new posts this week.\n'}

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
  renderDigestEmail
};

