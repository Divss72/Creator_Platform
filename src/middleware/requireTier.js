const ApiError = require('../utils/apiError');
const tierStore = require('../store/tierStore');
const { resolveViewerTier, canAccess } = require('../services/accessService');

/**
 * Middleware factory enforcing a fixed minimum subscription tier for specific routes.
 * (Note: Not used by general content routes since their minTier is dynamically evaluated per item).
 *
 * @param {string} requiredTierName - 'free' | 'pro' | 'vip'
 * @param {Function} [getCreatorId] - Optional extractor for creatorId from request context (defaults to req.params.creatorId || req.body.creatorId)
 */
const requireTier = (requiredTierName, getCreatorId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(ApiError.unauthorized('Authentication required'));
      }

      const creatorId = getCreatorId
        ? getCreatorId(req)
        : req.params.creatorId || req.body.creatorId || req.query.creatorId;

      if (!creatorId) {
        return next(ApiError.badRequest('Creator ID is required to evaluate tier access'));
      }

      const requiredTier = await tierStore.getByName(requiredTierName);
      if (!requiredTier) {
        return next(ApiError.internal(`Required tier '${requiredTierName}' is not defined`));
      }

      const viewerTierInfo = await resolveViewerTier({
        viewerId: req.user.id,
        creatorId
      });

      if (!canAccess(viewerTierInfo.rank, requiredTier.rank)) {
        return next(
          ApiError.forbidden(
            `This resource requires a minimum tier of '${requiredTierName}'. Your current tier is '${viewerTierInfo.tier}'.`
          )
        );
      }

      req.viewerTier = viewerTierInfo.tier;
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = requireTier;
