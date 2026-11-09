'use strict';

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const DEFAULT_EXAMPLE_JWT_SECRET = 'super-secret-jwt-key-change-in-production-min32chars';

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

  // Media Limits (in bytes)
  MEDIA_MAX_IMAGE_BYTES: z.coerce.number().default(5242880), // 5 MB
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().default(52428800), // 50 MB
  AVATAR_MAX_BYTES: z.coerce.number().default(2097152), // 2 MB
  MEDIA_MAX_PER_POST: z.coerce.number().default(5),
  MEDIA_QUOTA_BYTES_PER_CREATOR: z.coerce.number().default(209715200) // 200 MB
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[Fatal Error] Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

// Cloudinary credential checks (required in ANY environment if driver is cloudinary)
if (env.STORAGE_DRIVER === 'cloudinary') {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    console.error('[Fatal Error] CLOUDINARY_CLOUD_NAME is required when STORAGE_DRIVER is "cloudinary".');
    process.exit(1);
  }
  if (!env.CLOUDINARY_API_KEY) {
    console.error('[Fatal Error] CLOUDINARY_API_KEY is required when STORAGE_DRIVER is "cloudinary".');
    process.exit(1);
  }
  if (!env.CLOUDINARY_API_SECRET) {
    console.error('[Fatal Error] CLOUDINARY_API_SECRET is required when STORAGE_DRIVER is "cloudinary".');
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
}

module.exports = Object.freeze(env);
