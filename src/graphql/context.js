const { GraphQLError } = require('graphql');
const { verifyToken } = require('../utils/jwt');
const userStore = require('../store/userStore');
const tierStore = require('../store/tierStore');
const accessService = require('../services/accessService');
const { createLoaders } = require('./loaders');

/**
 * Builds the per-request GraphQL context from the Express req object.
 *
 * Rules:
 * - no token                     -> anonymous viewer (viewer = null)
 * - valid token                  -> viewer = { id, role, name } (allow-listed fields only)
 * - malformed or expired token   -> reject request with HTTP 401 and INVALID_TOKEN or TOKEN_EXPIRED
 */
const buildContext = async ({ req }) => {
  let viewer = null;
  const authHeader = req.headers.authorization;

  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      throw new GraphQLError('Malformed authentication header', {
        extensions: {
          code: 'INVALID_TOKEN',
          http: { status: 401 }
        }
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new GraphQLError('Missing authentication token', {
        extensions: {
          code: 'INVALID_TOKEN',
          http: { status: 401 }
        }
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new GraphQLError('Authentication token has expired', {
          extensions: {
            code: 'TOKEN_EXPIRED',
            http: { status: 401 }
          }
        });
      }
      throw new GraphQLError('Invalid authentication token', {
        extensions: {
          code: 'INVALID_TOKEN',
          http: { status: 401 }
        }
      });
    }

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      throw new GraphQLError('Invalid token payload', {
        extensions: {
          code: 'INVALID_TOKEN',
          http: { status: 401 }
        }
      });
    }

    const user = await userStore.findById(userId);
    if (!user) {
      throw new GraphQLError('User associated with this token no longer exists', {
        extensions: {
          code: 'INVALID_TOKEN',
          http: { status: 401 }
        }
      });
    }

    viewer = {
      id: user.id,
      role: user.role,
      name: user.name
    };
  }

  // Per-request loaders
  const loaders = createLoaders();

  // Memoized helpers for access profile and tiers
  let accessProfilePromise = null;
  const getAccessProfile = () => {
    if (!accessProfilePromise) {
      accessProfilePromise = accessService.getViewerAccessProfile({
        viewerId: viewer ? viewer.id : null
      });
    }
    return accessProfilePromise;
  };

  let tiersPromise = null;
  const getTiers = () => {
    if (!tiersPromise) {
      tiersPromise = tierStore.findAll();
    }
    return tiersPromise;
  };

  let tierRankMapPromise = null;
  const getTierRankMap = async () => {
    if (!tierRankMapPromise) {
      tierRankMapPromise = getTiers().then((tiers) => new Map(tiers.map((t) => [t.name, t.rank])));
    }
    return tierRankMapPromise;
  };

  return {
    viewer,
    loaders,
    getAccessProfile,
    getTiers,
    getTierRankMap
  };
};

module.exports = {
  buildContext
};
