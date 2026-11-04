'use strict';

/**
 * Data Sanitisation Backfill Script
 *
 * Runs post bodies through the rich-text sanitiser and strips tag-like sequences
 * (dropping contents of <script> and <style> elements) from plain-text fields.
 *
 * Usage:
 *   node scripts/sanitize-backfill.js         # DRY RUN (default, modifies nothing)
 *   node scripts/sanitize-backfill.js --apply # Commits sanitisation in batches
 */

const { sequelize, User, CreatorProfile, Content, Comment } = require('../src/models');
const { sanitizeRichText } = require('../src/services/sanitizeService');

const isApply = process.argv.includes('--apply');

/**
 * Repeatedly strips HTML tags and removes script/style contents from plain-text strings.
 */
function stripTagsRepeatedly(input, preserveNewlines = false) {
  if (!input || typeof input !== 'string') return input;

  let current = input.normalize('NFC');

  // Strip script and style contents completely
  current = current.replace(/<script[\s\S]*?<\/script>/gi, '');
  current = current.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Strip all other HTML tags repeatedly until none remain
  let previous;
  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, '');
  } while (current !== previous);

  // Remove bidi overrides and invisible zero-width chars
  current = current.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');

  // Remove control characters
  if (preserveNewlines) {
    current = current.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  } else {
    current = current.replace(/[\x00-\x1F\x7F]/g, '');
  }

  return current.trim();
}

async function runBackfill() {
  console.log(`\n=== CreatorHub Data Sanitisation Backfill [${isApply ? 'APPLY MODE' : 'DRY RUN'}] ===\n`);

  try {
    await sequelize.authenticate();
    console.log('[DB] Connected to database.');

    const stats = {
      content: { total: 0, bodyModified: 0, titleModified: 0 },
      comments: { total: 0, bodyModified: 0 },
      users: { total: 0, nameModified: 0 },
      creatorProfiles: { total: 0, displayNameModified: 0, bioModified: 0 }
    };

    // 1. Process Content (Rich text body, Plain text title)
    const contents = await Content.findAll();
    stats.content.total = contents.length;

    for (const post of contents) {
      const cleanBody = sanitizeRichText(post.body || '');
      const cleanTitle = stripTagsRepeatedly(post.title || '');

      let changed = false;
      if (cleanBody !== post.body) {
        stats.content.bodyModified++;
        changed = true;
      }
      if (cleanTitle !== post.title) {
        stats.content.titleModified++;
        changed = true;
      }

      if (changed && isApply) {
        await post.update({ body: cleanBody, title: cleanTitle });
      }
    }

    // 2. Process Comments (Plain text body)
    const comments = await Comment.findAll();
    stats.comments.total = comments.length;

    for (const comment of comments) {
      const cleanBody = stripTagsRepeatedly(comment.body || '', true);
      if (cleanBody !== comment.body) {
        stats.comments.bodyModified++;
        if (isApply) {
          await comment.update({ body: cleanBody });
        }
      }
    }

    // 3. Process Users (Plain text name)
    const users = await User.findAll();
    stats.users.total = users.length;

    for (const user of users) {
      const cleanName = stripTagsRepeatedly(user.name || '');
      if (cleanName !== user.name) {
        stats.users.nameModified++;
        if (isApply) {
          await user.update({ name: cleanName });
        }
      }
    }

    // 4. Process Creator Profiles (Plain text displayName, bio)
    const profiles = await CreatorProfile.findAll();
    stats.creatorProfiles.total = profiles.length;

    for (const profile of profiles) {
      const cleanDisplayName = stripTagsRepeatedly(profile.displayName || '');
      const cleanBio = profile.bio ? stripTagsRepeatedly(profile.bio, true) : profile.bio;

      let changed = false;
      if (cleanDisplayName !== profile.displayName) {
        stats.creatorProfiles.displayNameModified++;
        changed = true;
      }
      if (cleanBio !== profile.bio) {
        stats.creatorProfiles.bioModified++;
        changed = true;
      }

      if (changed && isApply) {
        await profile.update({ displayName: cleanDisplayName, bio: cleanBio });
      }
    }

    // Summary output
    console.log('--- Summary of Modifications ---');
    console.log(`Content Items (${stats.content.total} total):`);
    console.log(`  - body modified:        ${stats.content.bodyModified}`);
    console.log(`  - title modified:       ${stats.content.titleModified}`);
    console.log(`Comments (${stats.comments.total} total):`);
    console.log(`  - body modified:        ${stats.comments.bodyModified}`);
    console.log(`Users (${stats.users.total} total):`);
    console.log(`  - name modified:        ${stats.users.nameModified}`);
    console.log(`Creator Profiles (${stats.creatorProfiles.total} total):`);
    console.log(`  - displayName modified: ${stats.creatorProfiles.displayNameModified}`);
    console.log(`  - bio modified:         ${stats.creatorProfiles.bioModified}`);

    if (!isApply) {
      console.log('\n[Dry Run] No database rows were modified. Run with --apply to commit changes.');
    } else {
      console.log('\n[Applied] All modifications were safely persisted to the database.');
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('[Error during backfill]:', err);
    process.exit(1);
  }
}

runBackfill();
