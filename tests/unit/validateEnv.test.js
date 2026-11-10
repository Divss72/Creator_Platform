'use strict';

const { validateEnv } = require('../../src/config/env');

describe('Unit: validateEnv', () => {
  const validDevEnv = {
    NODE_ENV: 'development',
    JWT_SECRET: 'dev-jwt-secret-min16chars-test'
  };

  const validProdEnv = {
    NODE_ENV: 'production',
    PORT: '8080',
    JWT_SECRET: 'super-long-secure-random-jwt-secret-for-production-min-32-chars!',
    EMAIL_TOKEN_SECRET: 'super-long-secure-random-email-token-secret-for-production!',
    CORS_ORIGIN: 'https://creatorhub.example.com,https://admin.creatorhub.example.com',
    RATE_LIMIT_ENABLED: 'true',
    STORAGE_DRIVER: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-api-key',
    CLOUDINARY_API_SECRET: 'test-api-secret',
    MAIL_DRIVER: 'smtp',
    SMTP_HOST: 'smtp.mailgun.org',
    SMTP_PORT: '587',
    SMTP_USER: 'postmaster@creatorhub.example.com',
    SMTP_PASS: 'topsecretpass',
    EMAIL_FROM: 'noreply@creatorhub.example.com',
    FIREBASE_DRIVER: 'firebase',
    FIREBASE_DATABASE_URL: 'https://prod-creatorhub.firebaseio.com',
    FIREBASE_SERVICE_ACCOUNT_KEY: '{"type":"service_account","project_id":"prod"}'
  };

  describe('Development & Test Mode', () => {
    test('succeeds with minimal valid dev inputs and sets defaults', () => {
      const res = validateEnv(validDevEnv);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.config.PORT).toBe(5000);
      expect(res.config.NODE_ENV).toBe('development');
      expect(res.config.STORAGE_DRIVER).toBe('fake');
      expect(res.config.MAIL_DRIVER).toBe('log');
      expect(res.config.FIREBASE_DRIVER).toBe('fake');
      expect(res.config.RATE_LIMIT_ENABLED).toBe(true);
    });

    test('coerces port, boolean, and numeric values accurately', () => {
      const res = validateEnv({
        ...validDevEnv,
        PORT: '3000',
        RATE_LIMIT_ENABLED: 'false',
        TRUST_PROXY: '1'
      });
      expect(res.valid).toBe(true);
      expect(res.config.PORT).toBe(3000);
      expect(res.config.RATE_LIMIT_ENABLED).toBe(false);
      expect(res.config.TRUST_PROXY).toBe(1);
    });

    test('freezes the returned config object', () => {
      const res = validateEnv(validDevEnv);
      expect(Object.isFrozen(res.config)).toBe(true);
      expect(() => {
        res.config.PORT = 9999;
      }).toThrow();
    });

    test('fails if JWT_SECRET is shorter than 16 characters', () => {
      const res = validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: 'too-short'
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
    });

    test('fails if DIGEST_CRON expression is invalid', () => {
      const res = validateEnv({
        ...validDevEnv,
        DIGEST_CRON: 'invalid-cron-format'
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('DIGEST_CRON'))).toBe(true);
    });

    test('fails if DIGEST_TIMEZONE is not a valid IANA timezone', () => {
      const res = validateEnv({
        ...validDevEnv,
        DIGEST_TIMEZONE: 'Moon/Base_Alpha'
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('DIGEST_TIMEZONE'))).toBe(true);
    });

    test('requires service account credentials when FIREBASE_DRIVER is "firebase"', () => {
      const res = validateEnv({
        ...validDevEnv,
        FIREBASE_DRIVER: 'firebase'
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('service account'))).toBe(true);
    });
  });

  describe('Strict Production Mode', () => {
    test('succeeds with a complete and secure production configuration', () => {
      const res = validateEnv(validProdEnv);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.config.NODE_ENV).toBe('production');
      expect(res.config.STORAGE_DRIVER).toBe('cloudinary');
      expect(res.config.MAIL_DRIVER).toBe('smtp');
    });

    test('rejects wildcard "*" or empty CORS_ORIGIN in production', () => {
      const wildcardRes = validateEnv({ ...validProdEnv, CORS_ORIGIN: '*' });
      expect(wildcardRes.valid).toBe(false);
      expect(wildcardRes.errors.some((e) => e.includes('CORS_ORIGIN'))).toBe(true);

      const emptyRes = validateEnv({ ...validProdEnv, CORS_ORIGIN: '   ' });
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.errors.some((e) => e.includes('CORS_ORIGIN'))).toBe(true);
    });

    test('rejects RATE_LIMIT_ENABLED === false in production', () => {
      const res = validateEnv({ ...validProdEnv, RATE_LIMIT_ENABLED: 'false' });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('RATE_LIMIT_ENABLED'))).toBe(true);
    });

    test('rejects fake storage driver in production', () => {
      const res = validateEnv({ ...validProdEnv, STORAGE_DRIVER: 'fake' });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('STORAGE_DRIVER'))).toBe(true);
    });

    test('rejects missing Cloudinary credentials in production when driver is cloudinary', () => {
      const res = validateEnv({
        ...validProdEnv,
        CLOUDINARY_API_KEY: '',
        CLOUDINARY_API_SECRET: ''
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Cloudinary credentials'))).toBe(true);
    });

    test('rejects default example secrets or secrets shorter than 32 chars in production', () => {
      const defaultJwtRes = validateEnv({
        ...validProdEnv,
        JWT_SECRET: 'super-secret-jwt-key-change-in-production-min32chars'
      });
      expect(defaultJwtRes.valid).toBe(false);
      expect(defaultJwtRes.errors.some((e) => e.includes('JWT_SECRET cannot be the default'))).toBe(true);

      const shortJwtRes = validateEnv({
        ...validProdEnv,
        JWT_SECRET: 'only-25-characters-long!!'
      });
      expect(shortJwtRes.valid).toBe(false);
      expect(shortJwtRes.errors.some((e) => e.includes('at least 32 characters'))).toBe(true);

      const defaultEmailSecretRes = validateEnv({
        ...validProdEnv,
        EMAIL_TOKEN_SECRET: 'super-secret-email-token-key-change-in-prod-min32'
      });
      expect(defaultEmailSecretRes.valid).toBe(false);
      expect(defaultEmailSecretRes.errors.some((e) => e.includes('EMAIL_TOKEN_SECRET cannot be the default'))).toBe(true);
    });

    test('rejects missing SMTP credentials in production when MAIL_DRIVER is "smtp"', () => {
      const res = validateEnv({
        ...validProdEnv,
        SMTP_HOST: '',
        SMTP_PORT: ''
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('SMTP_HOST'))).toBe(true);
    });
  });
});

