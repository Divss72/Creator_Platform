'use strict';

const { GraphQLError, Kind } = require('graphql');
const { GRAPHQL_COST } = require('../../config/limits');

/**
 * Creates a GraphQL AST validation rule that limits the number of root fields
 * (including aliased fields and fragment spreads) per operation to prevent alias flooding.
 *
 * @param {number} maxFields Maximum allowed root-level fields (default: 10)
 * @returns {Function} GraphQL validation rule
 */
const createRootFieldsLimitRule = (maxFields = GRAPHQL_COST.MAX_ROOT_FIELDS) => {
  return (context) => {
    const fragments = Object.create(null);

    return {
      OperationDefinition(node) {
        // Collect all fragment definitions in document
        const definitions = context.getDocument().definitions;
        for (const def of definitions) {
          if (def.kind === Kind.FRAGMENT_DEFINITION) {
            fragments[def.name.value] = def;
          }
        }

        const countFields = (selectionSet, visitedFragments = new Set()) => {
          if (!selectionSet || !selectionSet.selections) return 0;
          let count = 0;

          for (const selection of selectionSet.selections) {
            if (selection.kind === Kind.FIELD) {
              // Introspection fields (__schema, __type) are exempted
              if (selection.name && selection.name.value.startsWith('__')) {
                continue;
              }
              count += 1;
            } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
              const fragName = selection.name.value;
              if (!visitedFragments.has(fragName) && fragments[fragName]) {
                visitedFragments.add(fragName);
                count += countFields(fragments[fragName].selectionSet, visitedFragments);
              }
            } else if (selection.kind === Kind.INLINE_FRAGMENT) {
              count += countFields(selection.selectionSet, visitedFragments);
            }
          }

          return count;
        };

        const totalRootFields = countFields(node.selectionSet);

        if (totalRootFields > maxFields) {
          context.reportError(
            new GraphQLError(
              `Operation has ${totalRootFields} root fields, exceeding maximum allowed limit of ${maxFields}`,
              {
                nodes: [node],
                extensions: { code: 'GRAPHQL_VALIDATION_FAILED' }
              }
            )
          );
        }
      }
    };
  };
};

module.exports = {
  createRootFieldsLimitRule
};
