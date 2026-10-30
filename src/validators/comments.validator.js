const { z } = require('zod');

const listCommentsSchema = {
  params: z.object({
    id: z.string().uuid('Invalid content ID format')
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    before: z.string().uuid('Invalid before cursor ID').optional()
  })
};

module.exports = {
  listCommentsSchema
};
