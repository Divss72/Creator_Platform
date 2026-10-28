const { z } = require('zod');

const updateProfileSchema = {
  body: z.object({
    displayName: z.string().trim().min(1, 'Display name cannot be empty').optional(),
    bio: z.string().trim().max(500, 'Bio must be at most 500 characters').optional()
  }).refine((data) => data.displayName !== undefined || data.bio !== undefined, {
    message: 'At least one field (displayName or bio) must be provided for update'
  })
};

module.exports = {
  updateProfileSchema
};
