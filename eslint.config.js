const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off',
      // Universal restriction: no sequelize.sync(), no eval, no new Function
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='sync']",
          message: 'Schema changes happen ONLY through migrations. Never call sequelize.sync().'
        },
        {
          selector: 'CallExpression[callee.name="eval"]',
          message: 'eval() is strictly forbidden.'
        },
        {
          selector: "NewExpression[callee.name='Function']",
          message: 'new Function() is strictly forbidden.'
        }
      ]
    }
  },
  // Architecture Rule 1: controllers, resolvers, realtime handlers, listeners, jobs, presenters, routes
  // MUST NOT import sequelize or models/
  {
    files: [
      'src/controllers/**',
      'src/graphql/resolvers/**',
      'src/realtime/**',
      'src/events/listeners.js',
      'src/jobs/**',
      'src/presenters/**',
      'src/routes/**'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'sequelize',
              message: 'Data access must go through src/store/, never direct Sequelize imports.'
            }
          ],
          patterns: [
            {
              group: ['*models*', '../*models*'],
              message:
                'Controllers/resolvers/handlers/jobs/routes must not import models directly; use store/.'
            }
          ]
        }
      ]
    }
  },
  // Architecture Rule 2: controllers and routes MUST NOT import socket.io, nodemailer, cloudinary, firebase-admin
  {
    files: ['src/controllers/**', 'src/routes/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'socket.io',
              message:
                'Controllers/routes must not import socket.io directly; use services/facades.'
            },
            {
              name: 'nodemailer',
              message: 'Controllers/routes must not import nodemailer directly; use mailService.'
            },
            {
              name: 'cloudinary',
              message: 'Controllers/routes must not import cloudinary directly; use storageDriver.'
            },
            {
              name: 'firebase-admin',
              message:
                'Controllers/routes must not import firebase-admin directly; use firebaseDriver.'
            },
            {
              name: 'sequelize',
              message: 'Data access must go through src/store/, never direct Sequelize imports.'
            }
          ],
          patterns: [
            {
              group: ['*models*', '../*models*'],
              message: 'Controllers/routes must not import models directly; use store/.'
            }
          ]
        }
      ]
    }
  },
  // Architecture Rule 3: services and presenters MUST NOT import express or socket.io
  {
    files: ['src/services/**', 'src/presenters/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'express',
              message: 'Services and presenters must be pure and free of Express framework objects.'
            },
            {
              name: 'socket.io',
              message: 'Services and presenters must not import socket.io.'
            }
          ]
        }
      ]
    }
  },
  // Ignore directories
  {
    ignores: [
      'web/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'docs/**',
      'public/**',
      'scripts/**',
      'tests/**',
      'src/database/migrations/**',
      'src/database/seeders/**'
    ]
  }
];
