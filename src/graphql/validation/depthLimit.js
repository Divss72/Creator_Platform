const { GraphQLError, Kind } = require('graphql');

/**
 * Creates a GraphQL AST validation rule that rejects queries nested beyond maxDepth.
 *
 * @param {number} maxDepth Maximum allowed selection set depth (default: 6)
 * @returns {Function} GraphQL validation rule
 */
const createDepthLimitRule = (maxDepth = 6) => {
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

        let reported = false;

        const checkDepth = (selectionSet, currentDepth, visitedFragments = new Set()) => {
          if (reported || !selectionSet || !selectionSet.selections) {
            return currentDepth;
          }

          let maxChildDepth = currentDepth;

          for (const selection of selectionSet.selections) {
            if (reported) break;

            if (selection.kind === Kind.FIELD) {
              // Introspection fields (__schema, __type) are exempted from depth calculation
              if (selection.name && selection.name.value.startsWith('__')) {
                continue;
              }

              const fieldDepth = currentDepth + 1;
              if (fieldDepth > maxDepth) {
                reported = true;
                context.reportError(
                  new GraphQLError(`Operation exceeds maximum query depth of ${maxDepth}`, {
                    nodes: [selection],
                    extensions: { code: 'GRAPHQL_VALIDATION_FAILED' }
                  })
                );
                return fieldDepth;
              }

              if (selection.selectionSet) {
                const childDepth = checkDepth(selection.selectionSet, fieldDepth, visitedFragments);
                if (childDepth > maxChildDepth) {
                  maxChildDepth = childDepth;
                }
              } else if (fieldDepth > maxChildDepth) {
                maxChildDepth = fieldDepth;
              }
            } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
              const fragmentName = selection.name.value;
              if (!visitedFragments.has(fragmentName)) {
                const fragment = fragments[fragmentName];
                if (fragment && fragment.selectionSet) {
                  visitedFragments.add(fragmentName);
                  const childDepth = checkDepth(
                    fragment.selectionSet,
                    currentDepth,
                    visitedFragments
                  );
                  visitedFragments.delete(fragmentName);
                  if (childDepth > maxChildDepth) {
                    maxChildDepth = childDepth;
                  }
                }
              }
            } else if (selection.kind === Kind.INLINE_FRAGMENT) {
              if (selection.selectionSet) {
                const childDepth = checkDepth(
                  selection.selectionSet,
                  currentDepth,
                  visitedFragments
                );
                if (childDepth > maxChildDepth) {
                  maxChildDepth = childDepth;
                }
              }
            }
          }

          return maxChildDepth;
        };

        checkDepth(node.selectionSet, 0);
      }
    };
  };
};

module.exports = {
  createDepthLimitRule
};
