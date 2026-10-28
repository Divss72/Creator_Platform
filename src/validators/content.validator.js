const { z } = require('zod');

const createContentSchema = {
  body: z.object({
    title: z.string().trim().min(1, 'Title cannot be empty'),
    body: z.string().trim().min(1, 'Body cannot be empty'),
    minTier: z.enum(['free', 'pro', 'vip'], {
      errorMap: () => ({ message: "minTier must be 'free', 'pro', or 'vip'" })
    }).default('free')
  })
};

const updateContentSchema = {
  params: z.object({
    id: z.string().uuid('Invalid content ID format')
  }),
  body: z.object({
    title: z.string().trim().min(1, 'Title cannot be empty').optional(),
    body: z.string().trim().min(1, 'Body cannot be empty').optional(),
    minTier: z.enum(['free', 'pro', 'vip'], {
      errorMap: () => ({ message: "minTier must be 'free', 'pro', or 'vip'" })
    }).optional()
  }).refine((data) => data.title !== undefined || data.body !== undefined || data.minTier !== undefined, {
    message: 'At least one field (title, body, or minTier) must be provided'
  })
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
