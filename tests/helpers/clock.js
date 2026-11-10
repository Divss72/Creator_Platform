'use strict';

/**
 * Creates an injectable mock clock for deterministic time manipulation in tests.
 *
 * @param {Date|string|number} [initialDate='2026-11-10T12:00:00.000Z']
 */
function createMockClock(initialDate = '2026-11-10T12:00:00.000Z') {
  let currentTime = new Date(initialDate).getTime();

  return {
    now: () => new Date(currentTime),
    getTime: () => currentTime,
    advance(ms) {
      currentTime += ms;
      return new Date(currentTime);
    },
    advanceDays(days) {
      return this.advance(days * 24 * 60 * 60 * 1000);
    },
    set(newDate) {
      currentTime = new Date(newDate).getTime();
      return new Date(currentTime);
    }
  };
}

module.exports = { createMockClock };
