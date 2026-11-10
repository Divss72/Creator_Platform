'use strict';

const dotenv = require('dotenv');
const cron = require('node-cron');
const { z } = require('zod');

dotenv.config();

const DEFAULT_EXAMPLE_JWT_SECRET = 'super-secret-jwt-key-change-in-production-min32chars';
const DEFAULT_EXAMPLE_EMAIL_TOKEN_SECRET = 'super-secret-email-token-key-change-in-prod-min32';
const DEFAULT_EXAMPLE_ANALYTICS_HASH_SECRET =
  'super-secret-analytics-hash-key-change-in-prod-min32';

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  // Database Configuration
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3307),
  DB_NAME: z.string().default('creatorhub_dev'),
  DB_NAME_TEST: z.string().default('creatorhub_test'),
  DB_USER: z.string().default('creatorhub_user'),
  DB_PASSWORD: z.string().default('creatorhub_pass'),
  DB_LOGGING: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(false)
    .transform((val) => val === true || val === 'true' || val === '1'),

  // Network & Security
  CORS_ORIGIN: z.string().default('*'),
  TRUST_PROXY: z
    .union([z.coerce.number(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(0)
    .transform((val) => {
      if (val === 'true' || val === true) return 1;
      if (val === 'false' || val === false) return 0;
      return typeof val === 'number' ? val : parseInt(val, 10) || 0;
    }),
  RATE_LIMIT_ENABLED: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(true)
    .transform((val) => val === true || val === 'true' || val === '1'),

  // Storage Driver Configuration
  STORAGE_DRIVER: z.enum(['cloudinary', 'fake']).default('fake'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Mail Driver Configuration
  MAIL_DRIVER: z.enum(['smtp', 'log']).default('log'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(false)
    .transform((val) => val === true || val === 'true' || val === '1'),
  EMAIL_FROM: z.string().default('noreply@creatorhub.local'),
  MAIL_FROM: z.string().optional(),

  // URLs & Worker Settings
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  API_BASE_URL: z.string().default('http://localhost:5000'),
  JOBS_ENABLED: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(true)
    .transform((val) => val === true || val === 'true' || val === '1'),
  EMAIL_WORKER_POLL_MS: z.coerce.number().default(5000),
  EMAIL_WORKER_BATCH_SIZE: z.coerce.number().default(50),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().default(5),
  EMAIL_RATE_LIMIT_PER_SEC: z.coerce.number().default(10),
  EMAIL_MAX_PER_RECIPIENT_PER_DAY: z.coerce.number().default(20),
  EMAIL_RETRY_DELAYS_SECONDS: z
    .string()
    .default('60,300,900,3600,14400')
    .transform((val) =>
      val
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter(Boolean)
    ),
  EMAIL_TOKEN_SECRET: z.string().default(DEFAULT_EXAMPLE_EMAIL_TOKEN_SECRET),

  // Digest Cron & Timezone
  DIGEST_CRON: z.string().default('0 9 * * 1'),
  DIGEST_TIMEZONE: z.string().default('UTC'),
  DIGEST_MAX_POSTS: z.coerce.number().default(10),

  // Firebase Realtime Database
  FIREBASE_DRIVER: z.enum(['firebase', 'fake', 'off']).default('fake'),
  FIREBASE_DATABASE_URL: z.string().default('https://creatorhub-default-rtdb.firebaseio.com'),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FIREBASE_SYNC_DEBOUNCE_MS: z.coerce.number().default(500),

  // v0.8 Production Readiness & CI/CD
  DEPLOY_VERIFY_TOKEN: z.string().optional(),
  RUN_MIGRATIONS: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(false)
    .transform((val) => val === true || val === 'true' || val === '1'),
  ALLOW_DEMO_SEED: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(false)
    .transform((val) => val === true || val === 'true' || val === '1'),
  APP_VERSION: z.string().default('1.0.0'),
  APP_COMMIT: z.string().default('unknown'),
  APP_BUILT_AT: z.string().default('unknown'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'silent']).default('info'),

  // v1.0 Analytics, Trending & Frontend
  ANALYTICS_HASH_SECRET: z.string().default(DEFAULT_EXAMPLE_ANALYTICS_HASH_SECRET),
  ROLLUP_CRON: z.string().default('15 2 * * *'),
  TRENDING_CRON: z.string().default('*/15 * * * *'),
  TRENDING_WINDOW_DAYS: z.coerce.number().default(30),
  TRENDING_MAX_ITEMS: z.coerce.number().default(50),
  TRENDING_WEIGHT_VIEWS: z.coerce.number().default(1),
  TRENDING_WEIGHT_COMMENTS: z.coerce.number().default(2),
  TRENDING_WEIGHT_LIKES: z.coerce.number().default(3),
  TRENDING_GRAVITY: z.coerce.number().default(1.5),
  SERVE_WEB: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(false)
    .transform((val) => val === true || val === 'true' || val === '1'),
  CSP_CONNECT_EXTRA: z.string().optional().default(''),
  CSP_IMG_EXTRA: z.string().optional().default(''),
  DEMO_RESET_CONFIRM: z.string().optional()
});

/**
 * Pure function to validate environment configuration against schema and production rules.
 * @param {Object} rawEnv
 * @returns {{ valid: boolean, errors: string[], config: Object|null }}
 */
function validateEnv(rawEnv = {}) {
  const errors = [];
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    parsed.error.errors.forEach((err) => {
      errors.push(`${err.path.join('.')}: ${err.message}`);
    });
    return { valid: false, errors, config: null };
  }

  const config = { ...parsed.data };
  if (!config.EMAIL_FROM && config.MAIL_FROM) {
    config.EMAIL_FROM = config.MAIL_FROM;
  }

  // Check DIGEST_CRON format
  if (!cron.validate(config.DIGEST_CRON)) {
    errors.push(`Invalid DIGEST_CRON expression: "${config.DIGEST_CRON}"`);
  }

  // Check ROLLUP_CRON format
  if (!cron.validate(config.ROLLUP_CRON)) {
    errors.push(`Invalid ROLLUP_CRON expression: "${config.ROLLUP_CRON}"`);
  }

  // Check TRENDING_CRON format
  if (!cron.validate(config.TRENDING_CRON)) {
    errors.push(`Invalid TRENDING_CRON expression: "${config.TRENDING_CRON}"`);
  }

  // Check DIGEST_TIMEZONE
  try {
    Intl.DateTimeFormat(undefined, { timeZone: config.DIGEST_TIMEZONE });
  } catch (_err) {
    errors.push(`DIGEST_TIMEZONE ("${config.DIGEST_TIMEZONE}") is not a valid IANA timezone`);
  }

  // Firebase driver checks
  if (config.FIREBASE_DRIVER === 'firebase') {
    if (!config.FIREBASE_DATABASE_URL) {
      errors.push('FIREBASE_DATABASE_URL is required when FIREBASE_DRIVER is "firebase"');
    }
    const hasServiceAccount = Boolean(
      config.FIREBASE_SERVICE_ACCOUNT_KEY ||
      config.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      config.GOOGLE_APPLICATION_CREDENTIALS
    );
    if (!hasServiceAccount) {
      errors.push(
        'Firebase service account credentials are required when FIREBASE_DRIVER is "firebase"'
      );
    }
  }

  // Strict Production Rules
  if (config.NODE_ENV === 'production') {
    // 1. CORS_ORIGIN
    const origins = config.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (origins.length === 0 || origins.includes('*') || !config.CORS_ORIGIN.trim()) {
      errors.push('CORS_ORIGIN cannot be empty or contain wildcard ("*") in production mode');
    }

    // 2. RATE_LIMIT_ENABLED
    if (!config.RATE_LIMIT_ENABLED) {
      errors.push('RATE_LIMIT_ENABLED cannot be false in production mode');
    }

    // 3. STORAGE_DRIVER
    if (config.STORAGE_DRIVER === 'fake') {
      errors.push('STORAGE_DRIVER cannot be "fake" in production mode');
    }
    if (config.STORAGE_DRIVER === 'cloudinary') {
      if (
        !config.CLOUDINARY_CLOUD_NAME ||
        !config.CLOUDINARY_API_KEY ||
        !config.CLOUDINARY_API_SECRET
      ) {
        errors.push(
          'Cloudinary credentials (CLOUD_NAME, API_KEY, API_SECRET) are required in production'
        );
      }
    }

    // 4. JWT_SECRET
    if (config.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production mode');
    }
    if (config.JWT_SECRET === DEFAULT_EXAMPLE_JWT_SECRET) {
      errors.push('JWT_SECRET cannot be the default example value in production mode');
    }

    // 5. EMAIL_TOKEN_SECRET
    if (config.EMAIL_TOKEN_SECRET.length < 32) {
      errors.push('EMAIL_TOKEN_SECRET must be at least 32 characters in production mode');
    }
    if (config.EMAIL_TOKEN_SECRET === DEFAULT_EXAMPLE_EMAIL_TOKEN_SECRET) {
      errors.push('EMAIL_TOKEN_SECRET cannot be the default example value in production mode');
    }

    // 5b. ANALYTICS_HASH_SECRET
    if (config.ANALYTICS_HASH_SECRET.length < 32) {
      errors.push('ANALYTICS_HASH_SECRET must be at least 32 characters in production mode');
    }
    if (config.ANALYTICS_HASH_SECRET === DEFAULT_EXAMPLE_ANALYTICS_HASH_SECRET) {
      errors.push('ANALYTICS_HASH_SECRET cannot be the default example value in production mode');
    }

    // 6. MAIL_DRIVER check: if smtp, credentials required
    if (config.MAIL_DRIVER === 'smtp') {
      if (!config.SMTP_HOST) {
        errors.push('SMTP_HOST is required when MAIL_DRIVER is "smtp" in production mode');
      }
      if (!config.SMTP_PORT) {
        errors.push('SMTP_PORT is required when MAIL_DRIVER is "smtp" in production mode');
      }
      if (!config.EMAIL_FROM && !config.MAIL_FROM) {
        errors.push('EMAIL_FROM is required when MAIL_DRIVER is "smtp" in production mode');
      }
    }

    // 7. FIREBASE_DRIVER check: if firebase, URL and credentials required
    if (config.FIREBASE_DRIVER === 'firebase') {
      if (!config.FIREBASE_DATABASE_URL) {
        errors.push(
          'FIREBASE_DATABASE_URL is required when FIREBASE_DRIVER is "firebase" in production mode'
        );
      }
      const hasServiceAccount = Boolean(
        config.FIREBASE_SERVICE_ACCOUNT_KEY ||
        config.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
        config.GOOGLE_APPLICATION_CREDENTIALS
      );
      if (!hasServiceAccount) {
        errors.push(
          'Firebase service account credentials are required when FIREBASE_DRIVER is "firebase" in production mode'
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    config: errors.length === 0 ? Object.freeze(config) : null
  };
}

// Prepare runtime environment with NODE_ENV=test defaults
const rawProcessEnv = { ...process.env };
if (rawProcessEnv.NODE_ENV === 'test') {
  rawProcessEnv.DB_NAME = rawProcessEnv.DB_NAME_TEST || 'creatorhub_test';
  rawProcessEnv.MAIL_DRIVER = 'log';
  rawProcessEnv.FIREBASE_DRIVER = 'fake';
  rawProcessEnv.STORAGE_DRIVER = 'fake';
  rawProcessEnv.JOBS_ENABLED = 'false';
  rawProcessEnv.RATE_LIMIT_ENABLED = 'false';
  rawProcessEnv.DB_LOGGING = 'false';
  rawProcessEnv.LOG_LEVEL = 'silent';
  rawProcessEnv.JWT_SECRET =
    rawProcessEnv.JWT_SECRET || 'test-jwt-secret-for-jest-suites-minimum-32-chars';
  rawProcessEnv.EMAIL_TOKEN_SECRET =
    rawProcessEnv.EMAIL_TOKEN_SECRET || 'test-email-token-secret-for-jest-suites-minimum-32-chars';
  rawProcessEnv.ANALYTICS_HASH_SECRET =
    rawProcessEnv.ANALYTICS_HASH_SECRET || 'test-analytics-hash-secret-minimum-32-chars';
}

const validation = validateEnv(rawProcessEnv);

if (!validation.valid) {
  console.error('\n================================================================');
  console.error('[CreatorHub] Invalid environment configuration:');
  validation.errors.forEach((err) => {
    console.error(` - ${err}`);
  });
  console.error('================================================================\n');
  process.exit(1);
}

const env = {
  ...validation.config,
  validateEnv,
  DEFAULT_EXAMPLE_JWT_SECRET,
  DEFAULT_EXAMPLE_EMAIL_TOKEN_SECRET,
  DEFAULT_EXAMPLE_ANALYTICS_HASH_SECRET
};

module.exports = Object.freeze(env);
