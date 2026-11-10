'use strict';

const { z } = require('zod');
const { cleanPlainText, containsHtmlTag } = require('../services/sanitizeService');

const titleSchema = z
  .string()
  .min(1, 'Title cannot be empty')
  .max(200, 'Title must not exceed 200 characters')
  .superRefine((val, ctx) => {
    if (containsHtmlTag(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HTML is not allowed here'
      });
    }
  })
  .transform((val) => cleanPlainText(val, { maxLength: 200, fieldName: 'Title' }));

const bodySchema = z
  .string()
  .min(1, 'Body cannot be empty')
  .max(100000, 'Body exceeds maximum length of 100000 characters');

const createContentSchema = {
  body: z.object({
    title: titleSchema,
    body: bodySchema,
    minTier: z
      .enum(['free', 'pro', 'vip'], {
        errorMap: () => ({ message: "minTier must be 'free', 'pro', or 'vip'" })
      })
      .default('free')
  })
};

const updateContentSchema = {
  params: z.object({
    id: z.string().uuid('Invalid content ID format')
  }),
  body: z
    .object({
      title: titleSchema.optional(),
      body: bodySchema.optional(),
      minTier: z
        .enum(['free', 'pro', 'vip'], {
          errorMap: () => ({ message: "minTier must be 'free', 'pro', or 'vip'" })
        })
        .optional()
    })
    .refine(
      (data) => data.title !== undefined || data.body !== undefined || data.minTier !== undefined,
      {
        message: 'At least one field (title, body, or minTier) must be provided'
      }
    )
};

const listContentSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10)
  })
};

const contentIdParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid content ID format')
  })
};

module.exports = {
  createContentSchema,
  updateContentSchema,
  listContentSchema,
  contentIdParamSchema
};
