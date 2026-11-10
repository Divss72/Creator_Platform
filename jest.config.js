'use strict';

module.exports = {
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/dev/**',
    '!src/database/migrations/**',
    '!src/database/seeders/**'
  ],
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      lines: 80,
      statements: 80,
      functions: 75,
      branches: 70
    },
    'src/services/accessService.js': {
      lines: 95,
      statements: 95,
      functions: 95,
      branches: 90
    },
    'src/utils/subscriptionStatus.js': {
      lines: 95,
      statements: 95,
      functions: 95,
      branches: 90
    },
    'src/services/sanitizeService.js': {
      lines: 95,
      statements: 95,
      functions: 95,
      branches: 90
    },
    'src/presenters/contentPresenter.js': {
      lines: 95,
      statements: 95,
      functions: 95,
      branches: 90
    },
    'src/services/commentService.js': {
      lines: 95,
      statements: 95,
      functions: 95,
      branches: 90
    },
    'src/services/notificationService.js': {
      lines: 90,
      statements: 90,
      functions: 90,
      branches: 85
    },
    'src/config/env.js': {
      lines: 90,
      statements: 90,
      functions: 90,
      branches: 80
    }
  },
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testEnvironmentOptions: {
        customExportConditions: ['node', 'require']
      },
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js']
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testEnvironmentOptions: {
        customExportConditions: ['node', 'require']
      },
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      globalSetup: '<rootDir>/tests/setup/globalSetup.js',
      globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js']
    }
  ]
};
