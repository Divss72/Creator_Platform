const { z } = require('zod');

const subscribeSchema = {
  body: z.object({
    creatorId: z.string().uuid('Invalid creator ID format'),
    tier: z.enum(['free', 'pro', 'vip'], {
      errorMap: () => ({ message: "Tier must be 'free', 'pro', or 'vip'" })
    })
  })
};

const creatorIdParamSchema = {
  params: z.object({
    creatorId: z.string().uuid('Invalid creator ID format')
  })
};

module.exports = {
  subscribeSchema,
  creatorIdParamSchema
};
