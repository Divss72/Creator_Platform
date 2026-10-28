const { z } = require('zod');

const registerSchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
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
