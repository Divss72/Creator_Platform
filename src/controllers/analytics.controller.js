'use strict';

const ApiError = require('../utils/apiError');
const analyticsService = require('../services/analyticsService');
const { VALID_RANGES } = require('../services/math/series');

const VALID_SORT_FIELDS = new Set(['views', 'likes', 'comments', 'trending']);

/**
 * Controller for Creator Analytics endpoints.
 * Strictly scoped to authenticated creator (req.user.id).
 * Sets Cache-Control: private, no-store.
 */
const analyticsController = {
  /**
   * GET /api/creators/me/analytics/overview
   */
  async getOverview(req, res) {
    const range = (req.query.range || '30d').toLowerCase().trim();
    if (!VALID_RANGES.has(range)) {
      throw ApiError.validation('Query parameter "range" must be one of: 7d, 30d, 90d');
    }

    res.setHeader('Cache-Control', 'private, no-store');

    const result = await analyticsService.getOverview({
      creatorId: req.user.id,
      range
    });

    res.status(200).json(result);
  },

  /**
   * GET /api/creators/me/analytics/timeseries
   */
  async getTimeseries(req, res) {
    const range = (req.query.range || '30d').toLowerCase().trim();
    if (!VALID_RANGES.has(range)) {
      throw ApiError.validation('Query parameter "range" must be one of: 7d, 30d, 90d');
    }

    res.setHeader('Cache-Control', 'private, no-store');

    const series = await analyticsService.getTimeseries({
      creatorId: req.user.id,
      range
    });

    res.status(200).json({
      range,
      series
    });
  },

  /**
   * GET /api/creators/me/analytics/top-content
   */
  async getTopContent(req, res) {
    const range = (req.query.range || '30d').toLowerCase().trim();
    if (!VALID_RANGES.has(range)) {
      throw ApiError.validation('Query parameter "range" must be one of: 7d, 30d, 90d');
    }

    const sortBy = (req.query.sortBy || 'views').toLowerCase().trim();
    if (!VALID_SORT_FIELDS.has(sortBy)) {
      throw ApiError.validation(
        'Query parameter "sortBy" must be one of: views, likes, comments, trending'
      );
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    if (isNaN(limit) || limit < 1 || limit > 50) {
      throw ApiError.validation('Query parameter "limit" must be an integer between 1 and 50');
    }

    res.setHeader('Cache-Control', 'private, no-store');

    const items = await analyticsService.getTopContent({
      creatorId: req.user.id,
      range,
      sortBy,
      limit
    });

    res.status(200).json({
      range,
      sortBy,
      items
    });
  }
};

module.exports = analyticsController;
