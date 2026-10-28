const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

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
    .transform((val) => val === 'true')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

module.exports = Object.freeze(parsedEnv.data);
