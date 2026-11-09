'use strict';

const DataLoader = require('dataloader');
const userStore = require('../store/userStore');
const commentStore = require('../store/commentStore');
const mediaStore = require('../store/mediaStore');

/**
 * Instantiate fresh DataLoaders per request.
 * Never share DataLoader instances across requests to prevent data leakage and stale caching.
 */
const createLoaders = () => {
  // Batch creator profile lookups by user ID
  const creatorLoader = new DataLoader(async (creatorIds) => {
    const creatorMap = await userStore.findCreatorsByIds(creatorIds);
    return creatorIds.map((id) => creatorMap.get(id) || null);
  });

  // Batch comment counts by content ID (SELECT content_id, COUNT(*) ... GROUP BY content_id)
  const commentCountLoader = new DataLoader(async (contentIds) => {
    const countsMap = await commentStore.countByContentIds(contentIds);
    return contentIds.map((id) => countsMap.get(id) || 0);
  });

  // Batch media items by content ID
  const mediaByContentIdLoader = new DataLoader(async (contentIds) => {
    const mediaMap = await mediaStore.listByContentIds(contentIds);
    return contentIds.map((id) => mediaMap.get(id) || []);
  });

  return {
    creatorLoader,
    commentCountLoader,
    mediaByContentIdLoader
  };
};

module.exports = {
  createLoaders
};
