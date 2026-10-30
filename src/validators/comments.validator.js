const { z } = require('zod');

const listCommentsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid content ID')
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    before: z.string().optional()
  })
});

module.exports = {
  listCommentsSchema
};
