'use strict';

const dotenv = require('dotenv');
const cron = require('node-cron');
const { z } = require('zod');

dotenv.config();

const DEFAULT_EXAMPLE_JWT_SECRET = 'super-secret-jwt-key-change-in-production-min32chars';
const DEFAULT_EXAMPLE_EMAIL_TOKEN_SECRET = 'super-secret-email-token-key-change-in-prod-min32';

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  // Database Configuration
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3307),
  DB_NAME: z.string().default('creatorhub_dev'),
  DB_USER: z.string().default('creatorhub_user'),
  DB_PASSWORD: z.string().default('creatorhub_pass'),
  DB_LOGGING: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((val) => val === 'true'),

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
    .enum(['true', 'false', '1', '0'])
    .optional()
    .default('true')
    .transform((val) => val === 'true' || val === '1'),

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
    .enum(['true', 'false', '1', '0'])
    .optional()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),
  EMAIL_FROM: z.string().default('noreply@creatorhub.local'),
  MAIL_FROM: z.string().optional(),

  // URLs & Worker Settings
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  API_BASE_URL: z.string().default('http://localhost:5000'),
  EMAIL_WORKER_POLL_MS: z.coerce.number().default(5000),
  EMAIL_WORKER_BATCH_SIZE: z.coerce.number().default(50),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().default(5),
  EMAIL_RATE_LIMIT_PER_SEC: z.coerce.number().default(10),
  EMAIL_MAX_PER_RECIPIENT_PER_DAY: z.coerce.number().default(20),
  EMAIL_RETRY_DELAYS_SECONDS: z
    .string()
    .default('60,300,900,3600,14400')
    .transform((val) => val.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean)),
  EMAIL_TOKEN_SECRET: z.string().default(DEFAULT_EXAMPLE_EMAIL_TOKEN_SECRET),

  // Digest Cron & Timezone
  DIGEST_CRON: z.string().default('0 9 * * 1'), // Every Monday at 09:00
  DIGEST_TIMEZONE: z.string().default('UTC'),
  DIGEST_MAX_POSTS: z.coerce.number().default(10),

  // Firebase Realtime Database
  FIREBASE_DRIVER: z.enum(['firebase', 'fake']).default('fake'),
  FIREBASE_DATABASE_URL: z.string().default('https://creatorhub-default-rtdb.firebaseio.com'),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FIREBASE_SYNC_DEBOUNCE_MS: z.coerce.number().default(500)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n================================================================');
  console.error('[CreatorHub] Invalid environment configuration:');
  parsed.error.errors.forEach((err) => {
    console.error(` - ${err.path.join('.')}: ${err.message}`);
  });
  console.error('================================================================\n');
  process.exit(1);
}

const env = { ...parsed.data };
if (!env.EMAIL_FROM && env.MAIL_FROM) {
  env.EMAIL_FROM = env.MAIL_FROM;
}

// Global Validation: DIGEST_CRON format
if (!cron.validate(env.DIGEST_CRON)) {
  console.error(`[Fatal Error] Invalid DIGEST_CRON expression: "${env.DIGEST_CRON}".`);
  process.exit(1);
}

// Global Validation: DIGEST_TIMEZONE must be valid IANA timezone
try {
  Intl.DateTimeFormat(undefined, { timeZone: env.DIGEST_TIMEZONE });
} catch (err) {
  console.error(`[Fatal Error] DIGEST_TIMEZONE ("${env.DIGEST_TIMEZONE}") is not a valid IANA timezone.`);
  process.exit(1);
}

// Global Validation: Firebase credentials required if driver is 'firebase'
if (env.FIREBASE_DRIVER === 'firebase') {
  if (!env.FIREBASE_DATABASE_URL) {
    console.error('[Fatal Error] FIREBASE_DATABASE_URL is required when FIREBASE_DRIVER is "firebase".');
    process.exit(1);
  }
  const hasServiceAccount = Boolean(
    env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
    env.GOOGLE_APPLICATION_CREDENTIALS
  );
  if (!hasServiceAccount) {
    console.error('[Fatal Error] Firebase service account credentials are required when FIREBASE_DRIVER is "firebase".');
    process.exit(1);
  }
}

// Strict Production Startup Checks
if (env.NODE_ENV === 'production') {
  // 1. CORS_ORIGIN check
  const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0 || origins.includes('*') || !env.CORS_ORIGIN.trim()) {
    console.error('[Fatal Error] CORS_ORIGIN cannot be empty or contain wildcard ("*") in production mode.');
    process.exit(1);
  }

  // 2. RATE_LIMIT_ENABLED check
  if (!env.RATE_LIMIT_ENABLED) {
    console.error('[Fatal Error] RATE_LIMIT_ENABLED cannot be false in production mode.');
    process.exit(1);
  }

  // 3. STORAGE_DRIVER check
  if (env.STORAGE_DRIVER === 'fake') {
    console.error('[Fatal Error] STORAGE_DRIVER cannot be "fake" in production mode.');
    process.exit(1);
  }

  // 4. JWT_SECRET check
  if (env.JWT_SECRET.length < 32) {
    console.error('[Fatal Error] JWT_SECRET must be at least 32 characters in production mode.');
    process.exit(1);
  }
  if (env.JWT_SECRET === DEFAULT_EXAMPLE_JWT_SECRET) {
    console.error('[Fatal Error] JWT_SECRET cannot be the default example value in production mode.');
    process.exit(1);
  }

  // 5. EMAIL_TOKEN_SECRET check
  if (env.EMAIL_TOKEN_SECRET.length < 32) {
    console.error('[Fatal Error] EMAIL_TOKEN_SECRET must be at least 32 characters in production mode.');
    process.exit(1);
  }
  if (env.EMAIL_TOKEN_SECRET === DEFAULT_EXAMPLE_EMAIL_TOKEN_SECRET) {
    console.error('[Fatal Error] EMAIL_TOKEN_SECRET cannot be the default example value in production mode.');
    process.exit(1);
  }

  // 6. MAIL_DRIVER check: if smtp, credentials required
  if (env.MAIL_DRIVER === 'smtp') {
    if (!env.SMTP_HOST) {
      console.error('[Fatal Error] SMTP_HOST is required when MAIL_DRIVER is "smtp" in production mode.');
      process.exit(1);
    }
    if (!env.SMTP_PORT) {
      console.error('[Fatal Error] SMTP_PORT is required when MAIL_DRIVER is "smtp" in production mode.');
      process.exit(1);
    }
    if (!env.EMAIL_FROM && !env.MAIL_FROM) {
      console.error('[Fatal Error] EMAIL_FROM is required when MAIL_DRIVER is "smtp" in production mode.');
      process.exit(1);
    }
  }

  // 7. FIREBASE_DRIVER check: if firebase, URL and credentials required
  if (env.FIREBASE_DRIVER === 'firebase') {
    if (!env.FIREBASE_DATABASE_URL) {
      console.error('[Fatal Error] FIREBASE_DATABASE_URL is required when FIREBASE_DRIVER is "firebase" in production mode.');
      process.exit(1);
    }
    const hasServiceAccount = Boolean(
      env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      env.GOOGLE_APPLICATION_CREDENTIALS
    );
    if (!hasServiceAccount) {
      console.error('[Fatal Error] Firebase service account credentials are required when FIREBASE_DRIVER is "firebase" in production mode.');
      process.exit(1);
    }
  }
}

module.exports = Object.freeze(env);
