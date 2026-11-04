const fs = require('fs');
const path = require('path');
const cors = require('cors');
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { ApolloServerPluginLandingPageLocalDefault } = require('@apollo/server/plugin/landingPage/default');
const { ApolloServerPluginLandingPageDisabled } = require('@apollo/server/plugin/disabled');

const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');
const resolvers = require('./resolvers');
const { buildContext } = require('./context');
const { formatError } = require('./errors');
const { createDepthLimitRule } = require('./validation/depthLimit');
const { queryCountPlugin, queryCounterMiddleware } = require('./plugins/queryCountPlugin');
const env = require('../config/env');

/**
 * Creates Apollo Server instance, starts it, and attaches middleware to the provided router.
 *
 * @param {express.Router} router Express router mounted at /graphql
 * @param {http.Server} httpServer Native Node HTTP server for drain plugin
 * @returns {Promise<ApolloServer>} Started ApolloServer instance
 */
const attachGraphQL = async (router, httpServer) => {
  const isDev = env.NODE_ENV === 'development';

  const plugins = [
    ApolloServerPluginDrainHttpServer({ httpServer })
  ];

  if (isDev) {
    plugins.push(ApolloServerPluginLandingPageLocalDefault({ embed: true }));
    plugins.push(queryCountPlugin);
  } else {
    plugins.push(ApolloServerPluginLandingPageDisabled());
  }

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    formatError,
    introspection: isDev,
    validationRules: [createDepthLimitRule(6)],
    plugins
  });

  await server.start();

  const corsOptions = {
    origin: isDev ? (env.CORS_ORIGIN || '*') : env.CORS_ORIGIN,
    credentials: true
  };

  router.use(
    cors(corsOptions),
    express.json({ limit: '100kb' }),
    queryCounterMiddleware,
    expressMiddleware(server, {
      context: buildContext
    })
  );

  return server;
};

module.exports = {
  attachGraphQL
};
