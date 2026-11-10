'use strict';

const { calculateTrendingScore } = require('../../src/services/math/trendingScore');

describe('Unit: trendingScore', () => {
  test('returns 0 when views, commenters, and likes are 0', () => {
    expect(calculateTrendingScore({ views: 0, commenters: 0, likes: 0, ageHours: 5 })).toBe(0);
    expect(calculateTrendingScore({})).toBe(0);
  });

  test('calculates correct score using default weights and gravity', () => {
    // Formula: (1*100 + 2*10 + 3*5) / (2 + 2)^1.5 = (100 + 20 + 15) / 4^1.5 = 135 / 8 = 16.875
    const score = calculateTrendingScore({
      views: 100,
      commenters: 10,
      likes: 5,
      ageHours: 2
    });
    expect(score).toBeCloseTo(16.875, 3);
  });

  test('applies custom weights and gravity from config', () => {
    // Custom config: wV=2, wC=5, wL=10, gravity=2.0
    // Numerator: 2*10 + 5*4 + 10*2 = 20 + 20 + 20 = 60
    // Denominator: (1 + 2)^2 = 9
    // Score: 60 / 9 = 6.6666...
    const score = calculateTrendingScore(
      { views: 10, commenters: 4, likes: 2, ageHours: 1 },
      { weightViews: 2, weightComments: 5, weightLikes: 10, gravity: 2 }
    );
    expect(score).toBeCloseTo(6.6667, 3);
  });

  test('decays monotonically as age increases', () => {
    const fresh = calculateTrendingScore({ views: 50, commenters: 5, likes: 5, ageHours: 1 });
    const oneDayOld = calculateTrendingScore({ views: 50, commenters: 5, likes: 5, ageHours: 24 });
    const threeDaysOld = calculateTrendingScore({
      views: 50,
      commenters: 5,
      likes: 5,
      ageHours: 72
    });

    expect(fresh).toBeGreaterThan(oneDayOld);
    expect(oneDayOld).toBeGreaterThan(threeDaysOld);
  });

  test('handles negative age gracefully by clamping to zero', () => {
    const scoreA = calculateTrendingScore({ views: 10, commenters: 2, likes: 1, ageHours: -5 });
    const scoreB = calculateTrendingScore({ views: 10, commenters: 2, likes: 1, ageHours: 0 });
    expect(scoreA).toBe(scoreB);
  });
});
