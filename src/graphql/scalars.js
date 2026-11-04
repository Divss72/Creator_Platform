const { GraphQLScalarType, Kind } = require('graphql');

/**
 * Custom DateTime scalar representation for ISO-8601 string timestamps.
 */
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO-8601 date string representation (e.g. 2026-11-04T09:25:00.000Z)',
  serialize(value) {
    if (!value) return null;
    if (value instanceof Date) {
      return value.toISOString();
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new TypeError(`Value is not a valid Date: ${value}`);
    }
    return d.toISOString();
  },
  parseValue(value) {
    if (typeof value !== 'string') {
      throw new TypeError(`DateTime must be a string, got ${typeof value}`);
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new TypeError(`DateTime string is invalid: ${value}`);
    }
    return d;
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new TypeError(`DateTime literal must be a string, got ${ast.kind}`);
    }
    const d = new Date(ast.value);
    if (isNaN(d.getTime())) {
      throw new TypeError(`DateTime literal is invalid: ${ast.value}`);
    }
    return d;
  }
});

module.exports = {
  DateTime: DateTimeScalar
};
