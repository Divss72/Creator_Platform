'use strict';

const { z } = require('zod');
const { cleanPlainText, containsHtmlTag } = require('../services/sanitizeService');

const displayNameSchema = z
  .string()
  .min(1, 'Display name cannot be empty')
  .max(60, 'Display name must not exceed 60 characters')
  .superRefine((val, ctx) => {
    if (containsHtmlTag(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HTML is not allowed here'
      });
    }
  })
  .transform((val) => cleanPlainText(val, { maxLength: 60, fieldName: 'Display name' }));

const bioSchema = z
  .string()
  .max(500, 'Bio must be at most 500 characters')
  .superRefine((val, ctx) => {
    if (containsHtmlTag(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HTML is not allowed here'
      });
    }
  })
  .transform((val) =>
    cleanPlainText(val, { maxLength: 500, fieldName: 'Bio', allowNewlines: true })
  );

const updateProfileSchema = {
  body: z
    .object({
      displayName: displayNameSchema.optional(),
      bio: bioSchema.optional()
    })
    .refine((data) => data.displayName !== undefined || data.bio !== undefined, {
      message: 'At least one field (displayName or bio) must be provided for update'
    })
};

module.exports = {
  updateProfileSchema
};
