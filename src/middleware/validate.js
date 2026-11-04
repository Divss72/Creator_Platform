const validate = (schema) => {
  return async (req, res, next) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }

      // If schema is a direct ZodType without body/query/params wrappers
      if (typeof schema.parseAsync === 'function' && !schema.body && !schema.query && !schema.params) {
        req.body = await schema.parseAsync(req.body);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = validate;
