'use strict';

const { z } = require('zod');
const { cleanPlainText, containsHtmlTag } = require('../services/sanitizeService');

const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must not exceed 100 characters')
  .superRefine((val, ctx) => {
    if (containsHtmlTag(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HTML is not allowed here'
      });
    }
  })
  .transform((val) => cleanPlainText(val, { maxLength: 100, fieldName: 'Name' }));

const registerSchema = {
  body: z.object({
    name: nameSchema,
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    role: z.enum(['creator', 'subscriber'], {
      errorMap: () => ({ message: "Role must be either 'creator' or 'subscriber'" })
    })
  })
};

const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
  })
};

module.exports = {
  registerSchema,
  loginSchema
};
